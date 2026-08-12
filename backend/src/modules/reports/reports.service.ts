import { Injectable } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BranchScopeService } from '../../common/scope/branch-scope.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { Prisma } from '../../generated/prisma/client';
import { Currency, ExpenseStatus } from '../../generated/prisma/enums';
import { resolvePeriod } from '../budgets/period';
import { SPEND_COUNTED_STATUSES } from '../expenses/expense-status';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import {
  DynamicsReportDto,
  GroupedReportDto,
  ReportFilterDto,
} from './dto/report-filter.dto';
import { ReportCacheService } from './report-cache.service';

/** Xodimlar hisobotida sukut bo'yicha TOP-10 (TZ 3.13) */
const DEFAULT_TOP = 10;

export interface ReportPeriod {
  from: string;
  to: string;
  /** `YYYY-MM` — sozlamadagi davr kaliti; ixtiyoriy sana oralig'ida `null` */
  key: string | null;
}

export interface CurrencyBreakdown {
  currency: Currency;
  /** O'z valyutasidagi summa */
  amount: string;
  amountUzs: string;
}

export interface SummaryReport {
  period: ReportPeriod;
  /** Effektiv sarf (qaytarilgani chegirilgan), UZS */
  totalUzs: string;
  expenseCount: number;
  /** Qaytarilgan summa, UZS */
  refundedUzs: string;
  employeeCount: number;
  avgPerEmployeeUzs: string;
  pendingDirectorCount: number;
  pendingAdminCount: number;
  /** Aralash valyutada har bir valyuta alohida ko'rinadi (TZ 3.13) */
  byCurrency: CurrencyBreakdown[];
}

export interface GroupedRow {
  /** Frontend jadvali uchun tayyor yorliq */
  group: string;
  groupId: string;
  count: number;
  totalAmount: string;
  /** Umumiy sarfdagi ulush, foiz */
  share: number;
}

export interface EmployeeRow extends GroupedRow {
  branchName: string;
}

export interface BranchRow extends GroupedRow {
  employeeCount: number;
  avgPerEmployee: string;
}

export interface DynamicsPoint {
  bucket: string;
  count: number;
  totalAmount: string;
}

export interface BudgetVsActualRow {
  budgetId: string;
  scope: string;
  scopeId: string;
  scopeName: string | null;
  limit: string;
  actual: string;
  variance: string;
  usedPercent: number;
}

interface RawTotal {
  total: string | null;
  count: number | bigint | null;
}

interface RawGroup {
  id: string;
  name: string | null;
  extra: string | null;
  count: number | bigint;
  total: string | null;
}

/**
 * Hisobotlar (TZ 3.13).
 *
 * Barcha summalar **effektiv**: `(amount − refundedAmount) × rateUsed`, ya'ni faqat
 * ikki bosqichdan o'tgan xarajatlar va qaytarilgani chegirilgan holda. Aralash
 * valyuta UZS ga snapshot kursida keltiriladi — hisobot tarixi o'zgarmaydi (TZ 3.5).
 *
 * Agregatlar raw SQL da: ustunlar ustidagi ifoda (`amount − refundedAmount`) va
 * `GROUP BY` ni Prisma `aggregate` bilan ifodalab bo'lmaydi, ustiga bir necha o'n ming
 * qatorni xotiraga tortish ham to'g'ri kelmaydi.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly cache: ReportCacheService,
    private readonly branchScope: BranchScopeService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Dashboard KPI
  // ───────────────────────────────────────────────────────────────────────────

  async summary(query: ReportFilterDto): Promise<SummaryReport> {
    const scope = await this.resolveScope(query);

    return this.cache.wrap(
      scope.companyId,
      'summary',
      scope.cacheKey,
      async () => {
        const [totals, refunded, currencies, pending, employeeCount] =
          await Promise.all([
            this.totalSpend(scope),
            this.refundedSpend(scope),
            this.currencyBreakdown(scope),
            this.pendingCounts(scope),
            this.employeeCount(scope),
          ]);

        const total = Money.round2(totals.total ?? 0);

        return {
          period: scope.period,
          totalUzs: Money.toString(total),
          expenseCount: Number(totals.count ?? 0),
          refundedUzs: Money.toString(refunded),
          employeeCount,
          avgPerEmployeeUzs: Money.toString(
            employeeCount > 0 ? total.div(employeeCount) : 0,
          ),
          pendingDirectorCount: pending.director,
          pendingAdminCount: pending.admin,
          byCurrency: currencies,
        };
      },
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Kesimlar
  // ───────────────────────────────────────────────────────────────────────────

  async byBranch(query: GroupedReportDto): Promise<BranchRow[]> {
    const scope = await this.resolveScope(query);

    return this.cache.wrap(
      scope.companyId,
      'by-branch',
      scope.cacheKey,
      async () => {
        /*
         * Xodim soni **alohida** so'rov bilan olinadi: `employees` ni `expenses` ga
         * qo'shsak har xarajat xodimlar soniga ko'payib, `SUM` bir necha barobar
         * katta chiqadi (`COUNT(DISTINCT)` to'g'ri bo'lsa ham).
         */
        const rows = await this.groupedQuery(
          scope,
          `b."id"`,
          `b."name"`,
          `NULL`,
          `JOIN "branches" b ON b."id" = e."branchId"`,
          query.limit,
        );

        const total = this.sumOf(rows);
        const employeeCounts = await this.activeEmployeeCounts(
          rows.map((row) => row.id),
        );

        return rows.map((row) => {
          const employeeCount = employeeCounts.get(row.id) ?? 0;
          const amount = Money.round2(row.total ?? 0);

          return {
            group: row.name ?? '—',
            groupId: row.id,
            count: Number(row.count),
            totalAmount: Money.toString(amount),
            share: share(amount, total),
            employeeCount,
            avgPerEmployee: Money.toString(
              employeeCount > 0 ? amount.div(employeeCount) : 0,
            ),
          };
        });
      },
    );
  }

  async byCategory(query: GroupedReportDto): Promise<GroupedRow[]> {
    const scope = await this.resolveScope(query);

    return this.cache.wrap(
      scope.companyId,
      'by-category',
      scope.cacheKey,
      async () => {
        const rows = await this.groupedQuery(
          scope,
          `c."id"`,
          `c."nameUz"`,
          `NULL`,
          `JOIN "categories" c ON c."id" = e."categoryId"`,
          query.limit,
        );

        const total = this.sumOf(rows);
        return rows.map((row) => this.toGroupedRow(row, total));
      },
    );
  }

  /**
   * Xodimlar kesimi ulushlar (`expense_shares`) bo'yicha hisoblanadi va qaytarish
   * nisbatiga proporsional kamaytiriladi — asl xarajat immutable bo'lgani uchun
   * ulushlar qaytarishda o'zgartirilmaydi (S9 da kelishilgan).
   */
  async byEmployee(query: GroupedReportDto): Promise<EmployeeRow[]> {
    const scope = await this.resolveScope(query);
    const limit = query.limit ?? DEFAULT_TOP;

    return this.cache.wrap(
      scope.companyId,
      'by-employee',
      { ...scope.cacheKey, limit },
      async () => {
        const rows = await this.prisma.db.$queryRawUnsafe<RawGroup[]>(
          `SELECT emp."id"        AS "id",
                  emp."fullName"  AS "name",
                  b."name"        AS "extra",
                  COUNT(DISTINCT e."id")::text AS "count",
                  COALESCE(SUM(
                    s."amountUzs" * (1 - e."refundedAmount" / e."amount")
                  ), 0)::text AS "total"
             FROM "expense_shares" s
             JOIN "expenses" e   ON e."id" = s."expenseId"
             JOIN "employees" emp ON emp."id" = s."employeeId"
             JOIN "branches" b    ON b."id" = emp."branchId"
            WHERE ${scope.where}
            GROUP BY emp."id", emp."fullName", b."name"
            HAVING COALESCE(SUM(s."amountUzs"), 0) > 0
            ORDER BY 5 DESC
            LIMIT ${limit}`,
          ...scope.params,
        );

        const total = this.sumOf(rows);

        return rows.map((row) => ({
          ...this.toGroupedRow(row, total),
          branchName: row.extra ?? '—',
        }));
      },
    );
  }

  async dynamics(query: DynamicsReportDto): Promise<DynamicsPoint[]> {
    const scope = await this.resolveScope(query);
    const granularity = query.granularity ?? 'month';

    return this.cache.wrap(
      scope.companyId,
      'dynamics',
      { ...scope.cacheKey, granularity },
      async () => {
        const rows = await this.prisma.db.$queryRawUnsafe<
          { bucket: Date; count: number | bigint; total: string | null }[]
        >(
          `SELECT date_trunc('${granularity}', e."date")::date AS "bucket",
                  COUNT(*)::text AS "count",
                  COALESCE(SUM((e."amount" - e."refundedAmount") * e."rateUsed"), 0)::text AS "total"
             FROM "expenses" e
            WHERE ${scope.where}
            GROUP BY 1
            ORDER BY 1 ASC`,
          ...scope.params,
        );

        return rows.map((row) => ({
          bucket: new Date(row.bucket).toISOString().slice(0, 10),
          count: Number(row.count),
          totalAmount: Money.toString(Money.round2(row.total ?? 0)),
        }));
      },
    );
  }

  /** Byudjet vs Fakt — limitlar joriy davr sarfi bilan yonma-yon (TZ 3.13) */
  async budgetVsActual(query: ReportFilterDto): Promise<BudgetVsActualRow[]> {
    const scope = await this.resolveScope(query);

    return this.cache.wrap(
      scope.companyId,
      'budget-vs-actual',
      scope.cacheKey,
      async () => {
        const budgets = await this.prisma.db.budget.findMany({
          where: {
            effectiveFrom: { lte: scope.to },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: scope.from } }],
          },
        });

        const rows: BudgetVsActualRow[] = [];

        for (const budget of budgets) {
          const actual = await this.actualForBudget(scope, budget);

          // Direktor uchun o'z filialidan tashqari limitlar ko'rinmaydi
          if (actual === null) continue;

          rows.push({
            budgetId: budget.id,
            scope: budget.scope,
            scopeId: budget.scopeId,
            scopeName: await this.scopeName(budget.scope, budget.scopeId),
            limit: Money.toString(budget.amount),
            actual: Money.toString(actual),
            variance: Money.toString(Money.sub(budget.amount, actual)),
            usedPercent: share(actual, budget.amount),
          });
        }

        return rows;
      },
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Filtr va davr
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Filtrlarni `WHERE` bo'lagi va parametrlarga aylantiradi.
   *
   * Filial doirasi shu yerda majburlanadi: direktor boshqa filialni so'rasa
   * `resolveListFilter` 403 beradi (TZ 3.13 qabul mezoni).
   */
  private async resolveScope(query: ReportFilterDto) {
    const companyId = this.tenantContext.requireCompanyId('Expense', 'read');
    const branchId = this.branchScope.resolveListFilter(query.branchId);
    const { from, to, key } = await this.resolveRange(query);

    const conditions = [
      `e."companyId" = $1`,
      `e."deletedAt" IS NULL`,
      `e."status"::text = ANY($2::text[])`,
      `e."date" BETWEEN $3 AND $4`,
    ];
    const params: unknown[] = [
      companyId,
      [...SPEND_COUNTED_STATUSES],
      from,
      to,
    ];

    const push = (sql: string, value: unknown): void => {
      params.push(value);
      conditions.push(sql.replace('$?', `$${params.length}`));
    };

    if (branchId) push(`e."branchId" = $?`, branchId);
    if (query.categoryId) push(`e."categoryId" = $?`, query.categoryId);
    if (query.paymentMethod) {
      push(`e."paymentMethod"::text = $?`, query.paymentMethod);
    }
    if (query.currency) push(`e."currency"::text = $?`, query.currency);
    if (query.amountFrom) {
      push(
        `(e."amount" - e."refundedAmount") * e."rateUsed" >= $?::numeric`,
        query.amountFrom,
      );
    }
    if (query.amountTo) {
      push(
        `(e."amount" - e."refundedAmount") * e."rateUsed" <= $?::numeric`,
        query.amountTo,
      );
    }
    if (query.employeeId) {
      push(
        `EXISTS (SELECT 1 FROM "expense_shares" es
                  WHERE es."expenseId" = e."id" AND es."employeeId" = $?)`,
        query.employeeId,
      );
    }

    return {
      companyId,
      branchId,
      from,
      to,
      period: { from: isoDate(from), to: isoDate(to), key },
      where: conditions.join(' AND '),
      params,
      // Kesh kaliti filtrlarga bog'lanadi; `companyId` prefiksda alohida
      cacheKey: {
        branchId: branchId ?? null,
        from: isoDate(from),
        to: isoDate(to),
        categoryId: query.categoryId ?? null,
        employeeId: query.employeeId ?? null,
        paymentMethod: query.paymentMethod ?? null,
        currency: query.currency ?? null,
        amountFrom: query.amountFrom ?? null,
        amountTo: query.amountTo ?? null,
      },
    };
  }

  private async resolveRange(
    query: ReportFilterDto,
  ): Promise<{ from: Date; to: Date; key: string | null }> {
    // Aniq sana oralig'i ustun: u sozlamadagi davrga bog'lanmaydi
    if (query.dateFrom || query.dateTo) {
      const from = query.dateFrom
        ? atUtcMidnight(query.dateFrom)
        : new Date(Date.UTC(1970, 0, 1));
      const to = query.dateTo
        ? atUtcMidnight(query.dateTo)
        : atUtcMidnight(new Date());
      return { from, to, key: null };
    }

    const { day } = await this.settings.get<{ day: number }>(
      SETTING_KEYS.reportPeriodStartDay,
    );

    const now = new Date();
    const current = resolvePeriod(now, day);

    if (query.period === 'previous') {
      // Joriy davr boshlanishidan bir kun oldingi sana o'tgan davrga tushadi
      const previous = resolvePeriod(
        new Date(current.start.getTime() - 86_400_000),
        day,
      );
      return { from: previous.start, to: previous.end, key: previous.key };
    }

    return { from: current.start, to: current.end, key: current.key };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Agregatlar
  // ───────────────────────────────────────────────────────────────────────────

  private async totalSpend(scope: {
    where: string;
    params: unknown[];
  }): Promise<RawTotal> {
    const rows = await this.prisma.db.$queryRawUnsafe<RawTotal[]>(
      `SELECT COALESCE(SUM((e."amount" - e."refundedAmount") * e."rateUsed"), 0)::text AS "total",
              COUNT(*)::text AS "count"
         FROM "expenses" e
        WHERE ${scope.where}`,
      ...scope.params,
    );
    return rows[0] ?? { total: '0', count: 0 };
  }

  private async refundedSpend(scope: {
    where: string;
    params: unknown[];
  }): Promise<Prisma.Decimal> {
    const rows = await this.prisma.db.$queryRawUnsafe<
      { total: string | null }[]
    >(
      `SELECT COALESCE(SUM(e."refundedAmount" * e."rateUsed"), 0)::text AS "total"
         FROM "expenses" e
        WHERE ${scope.where}`,
      ...scope.params,
    );
    return Money.round2(rows[0]?.total ?? 0);
  }

  private async currencyBreakdown(scope: {
    where: string;
    params: unknown[];
  }): Promise<CurrencyBreakdown[]> {
    const rows = await this.prisma.db.$queryRawUnsafe<
      { currency: Currency; amount: string | null; uzs: string | null }[]
    >(
      `SELECT e."currency" AS "currency",
              COALESCE(SUM(e."amount" - e."refundedAmount"), 0)::text AS "amount",
              COALESCE(SUM((e."amount" - e."refundedAmount") * e."rateUsed"), 0)::text AS "uzs"
         FROM "expenses" e
        WHERE ${scope.where}
        GROUP BY e."currency"
        ORDER BY 3 DESC`,
      ...scope.params,
    );

    return rows.map((row) => ({
      currency: row.currency,
      amount: Money.toString(Money.round2(row.amount ?? 0)),
      amountUzs: Money.toString(Money.round2(row.uzs ?? 0)),
    }));
  }

  /**
   * Navbatdagi arizalar soni — 1-bosqich va 2-bosqich **alohida** (TZ 3.13).
   * Bu ko'rsatkich sarf filtrlariga bog'lanmaydi: navbat har doim joriy holat.
   */
  private async pendingCounts(scope: {
    branchId?: string;
  }): Promise<{ director: number; admin: number }> {
    const where: Prisma.ExpenseWhereInput = {
      deletedAt: null,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
    };

    const [director, admin] = await Promise.all([
      this.prisma.db.expense.count({
        where: { ...where, status: ExpenseStatus.DIRECTOR_PENDING },
      }),
      this.prisma.db.expense.count({
        where: { ...where, status: ExpenseStatus.ADMIN_PENDING },
      }),
    ]);

    return { director, admin };
  }

  /** Filial → faol xodimlar soni */
  private async activeEmployeeCounts(
    branchIds: string[],
  ): Promise<Map<string, number>> {
    if (branchIds.length === 0) return new Map();

    const rows = await this.prisma.db.employee.groupBy({
      by: ['branchId'],
      where: { branchId: { in: branchIds }, status: 'ACTIVE' },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.branchId, row._count._all]));
  }

  private async employeeCount(scope: { branchId?: string }): Promise<number> {
    return this.prisma.db.employee.count({
      where: {
        status: 'ACTIVE',
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
      },
    });
  }

  private async groupedQuery(
    scope: { where: string; params: unknown[] },
    idExpr: string,
    nameExpr: string,
    extraExpr: string,
    joins: string,
    limit?: number,
  ): Promise<RawGroup[]> {
    return this.prisma.db.$queryRawUnsafe<RawGroup[]>(
      `SELECT ${idExpr}   AS "id",
              ${nameExpr} AS "name",
              ${extraExpr} AS "extra",
              COUNT(DISTINCT e."id")::text AS "count",
              COALESCE(SUM((e."amount" - e."refundedAmount") * e."rateUsed"), 0)::text AS "total"
         FROM "expenses" e
         ${joins}
        WHERE ${scope.where}
        GROUP BY 1, 2
        ORDER BY 5 DESC
        ${limit ? `LIMIT ${limit}` : ''}`,
      ...scope.params,
    );
  }

  /** Bitta limit uchun joriy oraliqdagi fakt; direktor doirasidan tashqarida `null` */
  private async actualForBudget(
    scope: { where: string; params: unknown[]; branchId?: string },
    budget: { scope: string; scopeId: string },
  ): Promise<Prisma.Decimal | null> {
    if (budget.scope === 'BRANCH') {
      if (scope.branchId && scope.branchId !== budget.scopeId) return null;

      const rows = await this.prisma.db.$queryRawUnsafe<
        { total: string | null }[]
      >(
        `SELECT COALESCE(SUM((e."amount" - e."refundedAmount") * e."rateUsed"), 0)::text AS "total"
           FROM "expenses" e
          WHERE ${scope.where} AND e."branchId" = $${scope.params.length + 1}`,
        ...scope.params,
        budget.scopeId,
      );
      return Money.round2(rows[0]?.total ?? 0);
    }

    if (budget.scope === 'CATEGORY') {
      const rows = await this.prisma.db.$queryRawUnsafe<
        { total: string | null }[]
      >(
        `SELECT COALESCE(SUM((e."amount" - e."refundedAmount") * e."rateUsed"), 0)::text AS "total"
           FROM "expenses" e
          WHERE ${scope.where} AND e."categoryId" = $${scope.params.length + 1}`,
        ...scope.params,
        budget.scopeId,
      );
      return Money.round2(rows[0]?.total ?? 0);
    }

    const employee = await this.prisma.db.employee.findUnique({
      where: { id: budget.scopeId },
      select: { branchId: true },
    });
    if (!employee) return null;
    if (scope.branchId && scope.branchId !== employee.branchId) return null;

    const rows = await this.prisma.db.$queryRawUnsafe<
      { total: string | null }[]
    >(
      `SELECT COALESCE(SUM(s."amountUzs" * (1 - e."refundedAmount" / e."amount")), 0)::text AS "total"
         FROM "expense_shares" s
         JOIN "expenses" e ON e."id" = s."expenseId"
        WHERE ${scope.where} AND s."employeeId" = $${scope.params.length + 1}`,
      ...scope.params,
      budget.scopeId,
    );
    return Money.round2(rows[0]?.total ?? 0);
  }

  private async scopeName(
    scope: string,
    scopeId: string,
  ): Promise<string | null> {
    if (scope === 'BRANCH') {
      const row = await this.prisma.db.branch.findUnique({
        where: { id: scopeId },
        select: { name: true },
      });
      return row?.name ?? null;
    }
    if (scope === 'CATEGORY') {
      const row = await this.prisma.db.category.findUnique({
        where: { id: scopeId },
        select: { nameUz: true },
      });
      return row?.nameUz ?? null;
    }
    const row = await this.prisma.db.employee.findUnique({
      where: { id: scopeId },
      select: { fullName: true },
    });
    return row?.fullName ?? null;
  }

  private toGroupedRow(row: RawGroup, total: Prisma.Decimal): GroupedRow {
    const amount = Money.round2(row.total ?? 0);

    return {
      group: row.name ?? '—',
      groupId: row.id,
      count: Number(row.count),
      totalAmount: Money.toString(amount),
      share: share(amount, total),
    };
  }

  private sumOf(rows: RawGroup[]): Prisma.Decimal {
    return Money.sum(rows.map((row) => Money.round2(row.total ?? 0)));
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

/** Ulush foizi — butun songa yaxlitlangan; baza 0 bo'lsa 0 */
function share(value: Prisma.Decimal, total: Prisma.Decimal): number {
  if (!Money.isPositive(total)) return 0;
  return Number(value.div(total).mul(100).toDecimalPlaces(0).toString());
}
