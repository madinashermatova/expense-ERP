import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import {
  Paginated,
  paginate,
  toSkipTake,
} from '../../common/dto/pagination.dto';
import { Money } from '../../common/money/money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import { Prisma } from '../../generated/prisma/client';
import {
  BudgetScope,
  Currency,
  ExpenseStatus,
  Role,
} from '../../generated/prisma/enums';
import {
  NOTIFICATION_TYPES,
  NotificationsService,
} from '../notifications/notifications.service';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import {
  BudgetUsageDto,
  CreateBudgetDto,
  ListBudgetsDto,
  UpdateBudgetDto,
} from './dto/budget.dto';
import { Period, resolvePeriod } from './period';

/** Ogohlantirish chegaralari (TZ 3.10) — yuqoridan pastga tekshiriladi */
export const BUDGET_THRESHOLDS = [100, 80] as const;

/**
 * Sarf hisobiga kiradigan statuslar: ikki bosqichdan o'tgan xarajatlar.
 * Qisman yoki to'liq qaytarilgan yozuv ham shu ro'yxatda — uning **effektiv**
 * summasi hisoblanadi (qaytarilgani chegirilgan), TZ 3.10.
 */
const COUNTED_STATUSES: ExpenseStatus[] = [
  ExpenseStatus.APPROVED,
  ExpenseStatus.PARTIALLY_REFUNDED,
  ExpenseStatus.REFUNDED,
];

export interface BudgetView {
  id: string;
  scope: BudgetScope;
  scopeId: string;
  scopeName: string | null;
  amount: string;
  currency: Currency;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: Date;
}

export interface BudgetUsageView extends BudgetView {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  spent: string;
  remaining: string;
  /** Butun songa yaxlitlangan foiz; limit 0 bo'lsa 0 */
  usedPercent: number;
}

export interface BudgetWarning {
  budgetId: string;
  scope: BudgetScope;
  scopeId: string;
  scopeName: string | null;
  limit: string;
  spent: string;
  /** Tekshirilayotgan xarajat qo'shilgandan keyingi sarf */
  projected: string;
  usedPercent: number;
  threshold: number;
}

interface EvaluateInput {
  branchId: string;
  categoryId: string;
  employeeIds: string[];
  date: Date;
  /** Sarfga qo'shiladigan summa (UZS); tasdiqlangan xarajat uchun 0 */
  extraUzs?: Prisma.Decimal;
  /** Chegara birinchi marta kesib o'tilganda bildirishnoma yuborish */
  notify?: boolean;
}

/**
 * Byudjet va yumshoq limitlar (TZ 3.10).
 *
 * Limit **bloklamaydi**: xarajat baribir yaratiladi, faqat javobda ogohlantirish qaytadi
 * va chegara birinchi marta kesib o'tilganda bildirishnoma yuboriladi.
 */
@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // CRUD (faqat ADMIN — kontrollerda majburlanadi)
  // ───────────────────────────────────────────────────────────────────────────

  async list(query: ListBudgetsDto): Promise<Paginated<BudgetView>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const where: Prisma.BudgetWhereInput = {};

    if (query.scope) where.scope = query.scope;
    if (query.scopeId) where.scopeId = query.scopeId;

    if (query.on) {
      const on = atUtcMidnight(query.on);
      where.effectiveFrom = { lte: on };
      where.OR = [{ effectiveTo: null }, { effectiveTo: { gte: on } }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.db.budget.findMany({
        where,
        orderBy: [{ scope: 'asc' }, { effectiveFrom: 'desc' }],
        skip,
        take,
      }),
      this.prisma.db.budget.count({ where }),
    ]);

    const names = await this.scopeNames(rows);

    return paginate(
      rows.map((row) => this.toView(row, names)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<BudgetView> {
    const budget = await this.prisma.db.budget.findUnique({ where: { id } });
    if (!budget) throw this.notFound();

    const names = await this.scopeNames([budget]);
    return this.toView(budget, names);
  }

  async create(dto: CreateBudgetDto): Promise<BudgetView> {
    const amount = Money.round2(dto.amount);
    if (!Money.isPositive(amount)) {
      throw this.unprocessable(
        'AMOUNT_NOT_POSITIVE',
        "Limit summasi noldan katta bo'lishi kerak",
        { amount: [dto.amount] },
      );
    }

    await this.assertScopeExists(dto.scope, dto.scopeId);

    const effectiveFrom = atUtcMidnight(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? atUtcMidnight(dto.effectiveTo) : null;
    this.assertRange(effectiveFrom, effectiveTo);

    await this.assertNoOverlap(
      dto.scope,
      dto.scopeId,
      effectiveFrom,
      effectiveTo,
    );

    const created = await this.prisma.db.budget.create({
      data: tenantData<Prisma.BudgetUncheckedCreateInput>({
        scope: dto.scope,
        scopeId: dto.scopeId,
        amount,
        currency: dto.currency ?? Currency.UZS,
        effectiveFrom,
        effectiveTo,
      }),
    });

    await this.audit.log({
      action: 'budget.create',
      entityType: 'Budget',
      entityId: created.id,
      changes: [
        { field: 'scope', old: null, new: `${dto.scope}:${dto.scopeId}` },
        { field: 'amount', old: null, new: Money.toString(amount) },
      ],
    });

    const names = await this.scopeNames([created]);
    return this.toView(created, names);
  }

  async update(id: string, dto: UpdateBudgetDto): Promise<BudgetView> {
    const budget = await this.prisma.db.budget.findUnique({ where: { id } });
    if (!budget) throw this.notFound();

    const amount = dto.amount ? Money.round2(dto.amount) : budget.amount;
    if (!Money.isPositive(amount)) {
      throw this.unprocessable(
        'AMOUNT_NOT_POSITIVE',
        "Limit summasi noldan katta bo'lishi kerak",
        { amount: [dto.amount ?? ''] },
      );
    }

    const effectiveFrom = dto.effectiveFrom
      ? atUtcMidnight(dto.effectiveFrom)
      : budget.effectiveFrom;

    // Bo'sh matn — muddatni cheksizga o'zgartirish usuli
    const effectiveTo =
      dto.effectiveTo === undefined
        ? budget.effectiveTo
        : dto.effectiveTo.trim() === ''
          ? null
          : atUtcMidnight(dto.effectiveTo);

    this.assertRange(effectiveFrom, effectiveTo);
    await this.assertNoOverlap(
      budget.scope,
      budget.scopeId,
      effectiveFrom,
      effectiveTo,
      id,
    );

    const updated = await this.prisma.db.budget.update({
      where: { id },
      data: { amount, effectiveFrom, effectiveTo },
    });

    await this.audit.log({
      action: 'budget.update',
      entityType: 'Budget',
      entityId: id,
      changes: this.audit.diff(
        {
          amount: Money.toString(budget.amount),
          effectiveFrom: isoDate(budget.effectiveFrom),
          effectiveTo: budget.effectiveTo ? isoDate(budget.effectiveTo) : null,
        },
        {
          amount: Money.toString(updated.amount),
          effectiveFrom: isoDate(updated.effectiveFrom),
          effectiveTo: updated.effectiveTo
            ? isoDate(updated.effectiveTo)
            : null,
        },
      ),
    });

    const names = await this.scopeNames([updated]);
    return this.toView(updated, names);
  }

  async remove(id: string): Promise<void> {
    const budget = await this.prisma.db.budget.findUnique({ where: { id } });
    if (!budget) throw this.notFound();

    await this.prisma.db.budget.delete({ where: { id } });

    await this.audit.log({
      action: 'budget.delete',
      entityType: 'Budget',
      entityId: id,
      changes: [
        { field: 'amount', old: Money.toString(budget.amount), new: null },
      ],
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Sarf va ogohlantirish
  // ───────────────────────────────────────────────────────────────────────────

  /** Amaldagi limitlar va joriy davrdagi sarf — ro'yxatdagi ⚠️ belgilari uchun */
  async usage(query: BudgetUsageDto): Promise<BudgetUsageView[]> {
    const on = query.on ? atUtcMidnight(query.on) : atUtcMidnight(new Date());
    const period = await this.periodFor(on);

    const budgets = await this.prisma.db.budget.findMany({
      where: {
        ...(query.scope ? { scope: query.scope } : {}),
        effectiveFrom: { lte: on },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: on } }],
      },
      orderBy: [{ scope: 'asc' }],
    });

    const names = await this.scopeNames(budgets);

    return Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.spentFor(budget, period);
        const view = this.toView(budget, names);

        return {
          ...view,
          periodKey: period.key,
          periodStart: isoDate(period.start),
          periodEnd: isoDate(period.end),
          spent: Money.toString(spent),
          remaining: Money.toString(Money.sub(budget.amount, spent)),
          usedPercent: percent(spent, budget.amount),
        };
      }),
    );
  }

  /**
   * Xarajat uchun amaldagi limitlarni baholaydi.
   *
   * `extraUzs` — hali sarfga kirmagan xarajat summasi: yaratish paytida yozuv
   * `DIRECTOR_PENDING` bo'ladi va sarfda hisoblanmaydi, lekin foydalanuvchiga
   * "bu xarajat limitdan oshiradi" deb aytish kerak (TZ 3.10 qabul mezoni).
   *
   * `notify` — chegara birinchi marta kesib o'tilganda bildirishnoma yuboriladi;
   * takrorlanmaslik `BudgetAlert` ning `UNIQUE(budgetId, period, threshold)` i bilan.
   */
  async evaluate(input: EvaluateInput): Promise<BudgetWarning[]> {
    const period = await this.periodFor(input.date);
    const budgets = await this.applicableBudgets(input);
    if (budgets.length === 0) return [];

    const names = await this.scopeNames(budgets);
    const warnings: BudgetWarning[] = [];

    for (const budget of budgets) {
      const spent = await this.spentFor(budget, period);
      const extra = this.extraFor(budget, input);
      const projected = Money.add(spent, extra);
      const used = percent(projected, budget.amount);

      const threshold = BUDGET_THRESHOLDS.find((value) => used >= value);
      if (threshold === undefined) continue;

      warnings.push({
        budgetId: budget.id,
        scope: budget.scope,
        scopeId: budget.scopeId,
        scopeName: names.get(`${budget.scope}:${budget.scopeId}`) ?? null,
        limit: Money.toString(budget.amount),
        spent: Money.toString(spent),
        projected: Money.toString(projected),
        usedPercent: used,
        threshold,
      });

      if (input.notify) {
        await this.sendAlertOnce(budget, period, threshold, projected);
      }
    }

    return warnings;
  }

  /** Tasdiqlangan xarajat yoki qaytarish sarfni o'zgartirgandan keyin chaqiriladi */
  async reevaluateForExpense(expenseId: string): Promise<void> {
    const expense = await this.prisma.db.expense.findUnique({
      where: { id: expenseId },
      select: {
        branchId: true,
        categoryId: true,
        date: true,
        shares: { select: { employeeId: true } },
      },
    });
    if (!expense) return;

    await this.evaluate({
      branchId: expense.branchId,
      categoryId: expense.categoryId,
      employeeIds: expense.shares.map((share) => share.employeeId),
      date: expense.date,
      notify: true,
    });
  }

  // ───────────────────────────────────────────────────────────────────────────

  private async periodFor(date: Date): Promise<Period> {
    const { day } = await this.settings.get<{ day: number }>(
      SETTING_KEYS.reportPeriodStartDay,
    );
    return resolvePeriod(date, day);
  }

  private async applicableBudgets(input: EvaluateInput) {
    return this.prisma.db.budget.findMany({
      where: {
        effectiveFrom: { lte: input.date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.date } }],
        AND: [
          {
            OR: [
              { scope: BudgetScope.BRANCH, scopeId: input.branchId },
              { scope: BudgetScope.CATEGORY, scopeId: input.categoryId },
              {
                scope: BudgetScope.EMPLOYEE,
                scopeId: { in: input.employeeIds },
              },
            ],
          },
        ],
      },
    });
  }

  /** Ushbu limit uchun yangi xarajatdan qancha summa qo'shiladi */
  private extraFor(
    budget: { scope: BudgetScope; scopeId: string },
    input: EvaluateInput,
  ): Prisma.Decimal {
    const extra = input.extraUzs;
    if (!extra) return Money.of(0);

    if (budget.scope !== BudgetScope.EMPLOYEE) return extra;

    /*
     * Xodim limitida faqat o'sha xodimning ulushi hisoblanadi. Ulushlar hali
     * yozilmagan bo'lishi mumkin (yaratishdan oldingi baholash), shuning uchun
     * teng taqsimlash taxmin qilinadi — ogohlantirish uchun bu yetarli aniqlik.
     */
    const count = input.employeeIds.length || 1;
    return Money.round2(extra.div(count));
  }

  /**
   * Davr ichidagi **effektiv** sarf (UZS).
   *
   * Raw so'rov ataylab: `(amount − refundedAmount) × rateUsed` ustunlar ustida
   * hisoblanadi, Prisma esa `aggregate` da bunday ifodani qo'llab-quvvatlamaydi.
   * `companyId` shartga qo'lda qo'shilgan — raw so'rov tenant extension dan o'tmaydi.
   */
  private async spentFor(
    budget: { scope: BudgetScope; scopeId: string },
    period: Period,
  ): Promise<Prisma.Decimal> {
    const companyId = this.tenantContext.requireCompanyId('Expense', 'read');
    const statuses = COUNTED_STATUSES;

    if (budget.scope === BudgetScope.EMPLOYEE) {
      const rows = await this.prisma.db.$queryRaw<{ spent: string | null }[]>`
        SELECT COALESCE(SUM(
                 s."amountUzs" * (1 - e."refundedAmount" / e."amount")
               ), 0)::text AS spent
          FROM "expense_shares" s
          JOIN "expenses" e ON e."id" = s."expenseId"
         WHERE s."companyId" = ${companyId}
           AND s."employeeId" = ${budget.scopeId}
           AND e."deletedAt" IS NULL
           AND e."status"::text = ANY(${statuses}::text[])
           AND e."date" BETWEEN ${period.start} AND ${period.end}
      `;
      return Money.round2(rows[0]?.spent ?? 0);
    }

    const column =
      budget.scope === BudgetScope.BRANCH ? 'branchId' : 'categoryId';

    const rows = await this.prisma.db.$queryRawUnsafe<
      { spent: string | null }[]
    >(
      `SELECT COALESCE(SUM(("amount" - "refundedAmount") * "rateUsed"), 0)::text AS spent
         FROM "expenses"
        WHERE "companyId" = $1
          AND "${column}" = $2
          AND "deletedAt" IS NULL
          AND "status"::text = ANY($3::text[])
          AND "date" BETWEEN $4 AND $5`,
      companyId,
      budget.scopeId,
      statuses,
      period.start,
      period.end,
    );

    return Money.round2(rows[0]?.spent ?? 0);
  }

  /**
   * Chegara bo'yicha bildirishnoma — bir davrda bir marta (TZ 3.10).
   *
   * `BudgetAlert` ning `UNIQUE(budgetId, period, threshold)` i takrorlanishni
   * bazada to'xtatadi: parallel ikki tasdiqlashdan faqat bittasi yozadi, ikkinchisi
   * `P2002` oladi va jim o'tib ketadi.
   */
  private async sendAlertOnce(
    budget: {
      id: string;
      scope: BudgetScope;
      scopeId: string;
      amount: Prisma.Decimal;
    },
    period: Period,
    threshold: number,
    projected: Prisma.Decimal,
  ): Promise<void> {
    try {
      await this.prisma.db.budgetAlert.create({
        data: tenantData<Prisma.BudgetAlertUncheckedCreateInput>({
          budgetId: budget.id,
          period: period.key,
          threshold,
        }),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Bu chegara bu davrda allaqachon xabar qilingan
        return;
      }
      throw error;
    }

    const payload = {
      budgetId: budget.id,
      scope: budget.scope,
      scopeId: budget.scopeId,
      period: period.key,
      threshold,
      limit: Money.toString(budget.amount),
      spent: Money.toString(projected),
    };

    const recipients = await this.alertRecipients(budget);
    await this.notifications.notifyUsers(
      recipients,
      NOTIFICATION_TYPES.budgetThreshold,
      payload,
    );

    this.logger.log(
      `Byudjet ogohlantirishi: ${budget.scope}:${budget.scopeId} — ${threshold}% (${period.key})`,
    );
  }

  /** Bosh adminlar + (filial limiti bo'lsa) o'sha filial direktorlari (TZ 3.10) */
  private async alertRecipients(budget: {
    scope: BudgetScope;
    scopeId: string;
  }): Promise<string[]> {
    const admins = await this.prisma.db.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });
    const ids = new Set(admins.map((a) => a.id));

    const branchId = await this.branchOf(budget);
    if (branchId) {
      const directors = await this.prisma.db.user.findMany({
        where: { role: Role.DIRECTOR, isActive: true, employee: { branchId } },
        select: { id: true },
      });
      for (const director of directors) ids.add(director.id);
    }

    return [...ids];
  }

  /** Limit qaysi filialga tegishli (kategoriya limiti filialga bog'lanmaydi) */
  private async branchOf(budget: {
    scope: BudgetScope;
    scopeId: string;
  }): Promise<string | null> {
    if (budget.scope === BudgetScope.BRANCH) return budget.scopeId;

    if (budget.scope === BudgetScope.EMPLOYEE) {
      const employee = await this.prisma.db.employee.findUnique({
        where: { id: budget.scopeId },
        select: { branchId: true },
      });
      return employee?.branchId ?? null;
    }

    return null;
  }

  private async assertScopeExists(
    scope: BudgetScope,
    scopeId: string,
  ): Promise<void> {
    const exists =
      scope === BudgetScope.BRANCH
        ? await this.prisma.db.branch.findUnique({ where: { id: scopeId } })
        : scope === BudgetScope.CATEGORY
          ? await this.prisma.db.category.findUnique({ where: { id: scopeId } })
          : await this.prisma.db.employee.findUnique({
              where: { id: scopeId },
            });

    if (!exists) {
      throw this.unprocessable(
        'SCOPE_NOT_FOUND',
        'Limit belgilanadigan obyekt topilmadi',
        { scopeId: [scopeId] },
      );
    }
  }

  private assertRange(from: Date, to: Date | null): void {
    if (to && to.getTime() < from.getTime()) {
      throw this.unprocessable(
        'INVALID_DATE_RANGE',
        "Tugash sanasi boshlanish sanasidan oldin bo'la olmaydi",
        { effectiveTo: [isoDate(to)] },
      );
    }
  }

  /**
   * Bir xil doiraga ustma-ust tushadigan ikki limit bo'lmaydi — aks holda qaysi
   * limit amalda ekani noaniq bo'lardi.
   */
  private async assertNoOverlap(
    scope: BudgetScope,
    scopeId: string,
    from: Date,
    to: Date | null,
    excludeId?: string,
  ): Promise<void> {
    const overlapping = await this.prisma.db.budget.findFirst({
      where: {
        scope,
        scopeId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        effectiveFrom: to ? { lte: to } : undefined,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
    });

    if (overlapping) {
      throw new ConflictException({
        statusCode: 409,
        code: 'BUDGET_OVERLAP',
        message: 'Bu doira uchun shu muddatda limit allaqachon belgilangan',
        details: { effectiveFrom: [isoDate(overlapping.effectiveFrom)] },
      });
    }
  }

  /** Doira nomlarini bitta so'rovda oladi — ro'yxatda N+1 bo'lmasligi uchun */
  private async scopeNames(
    budgets: { scope: BudgetScope; scopeId: string }[],
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (budgets.length === 0) return names;

    const byScope = (scope: BudgetScope): string[] =>
      budgets.filter((b) => b.scope === scope).map((b) => b.scopeId);

    const [branches, categories, employees] = await Promise.all([
      this.prisma.db.branch.findMany({
        where: { id: { in: byScope(BudgetScope.BRANCH) } },
        select: { id: true, name: true },
      }),
      this.prisma.db.category.findMany({
        where: { id: { in: byScope(BudgetScope.CATEGORY) } },
        select: { id: true, nameUz: true },
      }),
      this.prisma.db.employee.findMany({
        where: { id: { in: byScope(BudgetScope.EMPLOYEE) } },
        select: { id: true, fullName: true },
      }),
    ]);

    for (const row of branches) {
      names.set(`${BudgetScope.BRANCH}:${row.id}`, row.name);
    }
    for (const row of categories) {
      names.set(`${BudgetScope.CATEGORY}:${row.id}`, row.nameUz);
    }
    for (const row of employees) {
      names.set(`${BudgetScope.EMPLOYEE}:${row.id}`, row.fullName);
    }

    return names;
  }

  private toView(
    row: {
      id: string;
      scope: BudgetScope;
      scopeId: string;
      amount: Prisma.Decimal;
      currency: Currency;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      createdAt: Date;
    },
    names: Map<string, string>,
  ): BudgetView {
    return {
      id: row.id,
      scope: row.scope,
      scopeId: row.scopeId,
      scopeName: names.get(`${row.scope}:${row.scopeId}`) ?? null,
      amount: Money.toString(row.amount),
      currency: row.currency,
      effectiveFrom: isoDate(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? isoDate(row.effectiveTo) : null,
      createdAt: row.createdAt,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Limit topilmadi',
    });
  }

  private unprocessable(
    code: string,
    message: string,
    details?: Record<string, string[]>,
  ): BadRequestException {
    return new BadRequestException({ statusCode: 422, code, message, details });
  }
}

function atUtcMidnight(value: string | Date): Date {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Foiz — butun songa yaxlitlangan; limit 0 bo'lsa 0 (nolga bo'lish yo'q) */
function percent(spent: Prisma.Decimal, limit: Prisma.Decimal): number {
  if (!Money.isPositive(limit)) return 0;
  return Number(spent.div(limit).mul(100).toDecimalPlaces(0).toString());
}
