import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
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
import { BranchScopeService } from '../../common/scope/branch-scope.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import { Prisma } from '../../generated/prisma/client';
import {
  Currency,
  ExpenseStatus,
  RefundStatus,
  Role,
} from '../../generated/prisma/enums';
import { FilesService, UploadedFileInput } from '../files/files.service';
import {
  NOTIFICATION_TYPES,
  NotificationsService,
} from '../notifications/notifications.service';
import { CreateRefundDto, ListRefundsDto } from './dto/refund.dto';

export interface RefundView {
  id: string;
  expenseId: string;
  expenseGlobalNumber: string;
  expenseBranchNumber: string;
  branchId: string;
  amount: string;
  currency: Currency;
  rateUsed: string;
  amountUzs: string;
  reason: string;
  status: RefundStatus;
  requestedByUserId: string;
  directorApprovedByUserId: string | null;
  adminApprovedByUserId: string | null;
  approvedAt: Date | null;
  rejectReason: string | null;
  version: number;
  createdAt: Date;
  files: { id: string; originalName: string; mimeType: string }[];
}

type RefundRow = Prisma.RefundGetPayload<{
  include: {
    expense: {
      select: {
        globalNumber: true;
        branchNumber: true;
        branchId: true;
      };
    };
    files: { select: { id: true; originalName: true; mimeType: true } };
  };
}>;

const INCLUDE = {
  expense: {
    select: { globalNumber: true, branchNumber: true, branchId: true },
  },
  files: { select: { id: true, originalName: true, mimeType: true } },
} satisfies Prisma.RefundInclude;

/*
 * Byudjet sarfi bu yerda qayta hisoblanmaydi: sarf har doim so'rov vaqtida
 * `APPROVED` yozuvlarning effektiv summasidan hisoblanadi, ya'ni qaytarish
 * tasdiqlangach sarf o'z-o'zidan kamayadi. Ogohlantirish esa faqat chegara
 * **yuqoriga** kesib o'tilganda yuboriladi (TZ 3.10), shuning uchun kamayishda
 * hech narsa qilinmaydi.
 */

/** Qaytarish faqat shu statuslardagi xarajatga yaratiladi (TZ 3.9) */
const REFUNDABLE: ExpenseStatus[] = [
  ExpenseStatus.APPROVED,
  // Bir nechta qisman qaytarish mumkin, ya'ni birinchisidan keyin ham davom etadi
  ExpenseStatus.PARTIALLY_REFUNDED,
];

/**
 * Qaytarish moduli (TZ 3.9).
 *
 * Asl xarajat yozuvi **o'zgarmaydi**: qaytarish alohida bog'langan yozuv, xarajatda esa
 * faqat `refundedAmount` va status yangilanadi. Effektiv summa = `amount − refundedAmount`.
 */
@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly branchScope: BranchScopeService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // O'qish
  // ───────────────────────────────────────────────────────────────────────────

  async list(query: ListRefundsDto): Promise<Paginated<RefundView>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const where: Prisma.RefundWhereInput = {};

    if (query.status === 'PENDING') {
      where.status = {
        in: [RefundStatus.DIRECTOR_PENDING, RefundStatus.ADMIN_PENDING],
      };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.expenseId) where.expenseId = query.expenseId;

    const branchId = this.branchScope.resolveListFilter(query.branchId);
    if (branchId) where.expense = { branchId };

    const [rows, total] = await Promise.all([
      this.prisma.db.refund.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.db.refund.count({ where }),
    ]);

    return paginate(
      rows.map((row) => this.toView(row)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<RefundView> {
    const row = await this.prisma.db.refund.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!row) throw this.notFound();

    this.branchScope.assertCanAccess(row.expense.branchId);
    return this.toView(row);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Yaratish
  // ───────────────────────────────────────────────────────────────────────────

  async create(
    dto: CreateRefundDto,
    files: UploadedFileInput[],
  ): Promise<RefundView> {
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Foydalanuvchi aniqlanmadi',
      });
    }

    // Isbot fayli istisnosiz majburiy (TZ 3.9) — fayllar tekshiruvi hamma narsadan oldin
    if (files.length === 0) {
      throw this.unprocessable(
        'REFUND_PROOF_REQUIRED',
        'Qaytarish uchun isbot majburiy',
        { files: ['majburiy'] },
      );
    }

    const expense = await this.prisma.db.expense.findUnique({
      where: { id: dto.expenseId },
    });
    if (!expense || expense.deletedAt) throw this.notFound('Xarajat topilmadi');

    this.branchScope.assertCanWrite(expense.branchId);

    if (!REFUNDABLE.includes(expense.status)) {
      throw this.unprocessable(
        'EXPENSE_NOT_REFUNDABLE',
        'Qaytarish faqat tasdiqlangan xarajatga yaratiladi',
        { status: [expense.status] },
      );
    }

    const amount = Money.round2(dto.amount);
    if (!Money.isPositive(amount)) {
      throw this.unprocessable(
        'AMOUNT_NOT_POSITIVE',
        "Qaytarish summasi noldan katta bo'lishi kerak",
        { amount: [dto.amount] },
      );
    }

    /*
     * Qolgan summa = xarajat summasi − allaqachon qaytarilgani − **hali ko'rilmagan
     * so'rovlar**. Navbatdagi so'rovlarni hisobga olmasak, ikkita so'rov alohida-alohida
     * o'rinli bo'lib, ikkalasi tasdiqlanganda umumiy summadan oshib ketardi.
     */
    const pending = await this.prisma.db.refund.aggregate({
      where: {
        expenseId: expense.id,
        status: {
          in: [RefundStatus.DIRECTOR_PENDING, RefundStatus.ADMIN_PENDING],
        },
      },
      _sum: { amount: true },
    });

    const remaining = Money.sub(
      Money.sub(expense.amount, expense.refundedAmount),
      pending._sum.amount ?? 0,
    );

    if (amount.greaterThan(remaining)) {
      throw this.unprocessable(
        'REFUND_EXCEEDS_REMAINING',
        `Qaytarish summasi qolgan summadan (${Money.toString(remaining)}) oshmasligi kerak`,
        { amount: [Money.toString(amount)] },
      );
    }

    // Kurs asl xarajatdan meros olinadi — hisobot tarixi o'zgarmasligi uchun (TZ 3.9)
    const created = await this.prisma.db.refund.create({
      data: tenantData<Prisma.RefundUncheckedCreateInput>({
        expenseId: expense.id,
        amount,
        currency: expense.currency,
        rateUsed: expense.rateUsed,
        amountUzs: Money.toUzs(amount, expense.rateUsed),
        reason: dto.reason.trim(),
        requestedByUserId: userId,
        channel: this.tenantContext.channel,
      }),
    });

    await this.files.attachToRefund(created.id, files);

    await this.audit.log({
      action: 'refund.create',
      entityType: 'Refund',
      entityId: created.id,
      changes: [
        { field: 'expenseId', old: null, new: expense.id },
        { field: 'amount', old: null, new: Money.toString(amount) },
      ],
    });

    await this.notifyBranchDirectors(expense.branchId, {
      refundId: created.id,
      expenseId: expense.id,
      globalNumber: expense.globalNumber,
      amount: Money.toString(amount),
    });

    return this.findOne(created.id);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Ikki bosqichli tasdiqlash
  // ───────────────────────────────────────────────────────────────────────────

  async approve(id: string, version?: number): Promise<RefundView> {
    const { refund, role, userId } = await this.loadForDecision(id);

    if (refund.status === RefundStatus.DIRECTOR_PENDING) {
      await this.transition(refund, version, {
        status: RefundStatus.ADMIN_PENDING,
        directorApprovedByUserId: userId,
      });

      await this.notifications.notifyAdmins(
        NOTIFICATION_TYPES.refundSubmitted,
        { refundId: refund.id, expenseId: refund.expenseId },
      );

      await this.logDecision(refund, 'approve', RefundStatus.ADMIN_PENDING);
      return this.findOne(id);
    }

    // 2-bosqich — faqat bosh admin (TZ 3.9)
    if (role !== Role.ADMIN) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'STAGE_FORBIDDEN',
        message: 'Bu bosqichni faqat bosh admin hal qiladi',
      });
    }

    await this.transition(refund, version, {
      status: RefundStatus.APPROVED,
      adminApprovedByUserId: userId,
      approvedAt: new Date(),
    });

    await this.applyToExpense(refund.expenseId, refund.amount, refund.id);
    await this.logDecision(refund, 'approve', RefundStatus.APPROVED);

    await this.notifications.notifyUsers(
      [refund.requestedByUserId],
      NOTIFICATION_TYPES.refundResolved,
      { refundId: refund.id, status: RefundStatus.APPROVED },
    );

    return this.findOne(id);
  }

  async reject(
    id: string,
    reason: string,
    version?: number,
  ): Promise<RefundView> {
    const { refund } = await this.loadForDecision(id);

    await this.transition(refund, version, {
      status: RefundStatus.REJECTED,
      rejectReason: reason.trim(),
    });

    await this.logDecision(refund, 'reject', RefundStatus.REJECTED, reason);

    await this.notifications.notifyUsers(
      [refund.requestedByUserId],
      NOTIFICATION_TYPES.refundResolved,
      { refundId: refund.id, status: RefundStatus.REJECTED, reason },
    );

    return this.findOne(id);
  }

  // ───────────────────────────────────────────────────────────────────────────

  private async loadForDecision(id: string) {
    const userId = this.tenantContext.userId;
    const role = this.tenantContext.role;
    if (!userId || !role) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Foydalanuvchi aniqlanmadi',
      });
    }

    const refund = await this.prisma.db.refund.findUnique({
      where: { id },
      include: { expense: { select: { branchId: true } } },
    });
    if (!refund) throw this.notFound();

    this.branchScope.assertCanWrite(refund.expense.branchId);

    const open: RefundStatus[] = [
      RefundStatus.DIRECTOR_PENDING,
      RefundStatus.ADMIN_PENDING,
    ];
    if (!open.includes(refund.status)) {
      throw this.unprocessable(
        'INVALID_STATUS_TRANSITION',
        `«${refund.status}» holatidagi so'rovni qayta hal qilib bo'lmaydi`,
        { status: [refund.status] },
      );
    }

    return { refund, role, userId };
  }

  /** Optimistik blokirovka — xarajatlardagi bilan bir xil semantika (TZ 3.7) */
  private async transition(
    refund: { id: string; status: RefundStatus; version: number },
    expectedVersion: number | undefined,
    data: Prisma.RefundUncheckedUpdateInput,
  ): Promise<void> {
    const { count } = await this.prisma.db.refund.updateMany({
      where: {
        id: refund.id,
        version: expectedVersion ?? refund.version,
        status: refund.status,
      },
      data: { ...data, version: { increment: 1 } },
    });

    if (count === 0) {
      throw new ConflictException({
        statusCode: 409,
        code: 'ALREADY_PROCESSED',
        message: "So'rov allaqachon qayta ishlangan",
      });
    }
  }

  /**
   * Tasdiqlangan qaytarishni xarajatga yozadi.
   *
   * Yig'indi chegarasi **bitta shartli `UPDATE` ichida** tekshiriladi
   * (`refundedAmount + ? <= amount`): ikkita qaytarish bir vaqtda tasdiqlansa,
   * ikkinchisi shu yerda to'xtaydi. Prisma bu solishtiruvni ifodalay olmaydi —
   * ustunni ustun bilan taqqoslash kerak, shuning uchun raw `UPDATE`.
   */
  private async applyToExpense(
    expenseId: string,
    amount: Prisma.Decimal,
    refundId: string,
  ): Promise<void> {
    const companyId = this.tenantContext.requireCompanyId('Expense', 'update');
    const value = Money.toString(amount);

    const affected = await this.prisma.db.$executeRaw`
      UPDATE "expenses"
         SET "refundedAmount" = "refundedAmount" + ${value}::numeric,
             "version" = "version" + 1,
             "updatedAt" = now()
       WHERE "id" = ${expenseId}
         AND "companyId" = ${companyId}
         AND "refundedAmount" + ${value}::numeric <= "amount"
    `;

    if (affected === 0) {
      throw this.unprocessable(
        'REFUND_EXCEEDS_REMAINING',
        'Qaytarish summasi xarajatning qolgan summasidan oshib ketdi',
        { amount: [value] },
      );
    }

    const expense = await this.prisma.db.expense.findUniqueOrThrow({
      where: { id: expenseId },
      select: { amount: true, refundedAmount: true, status: true },
    });

    // To'liq qaytarilganda avtomatik REFUNDED ga o'tadi (TZ 3.9)
    const status = Money.equals(expense.refundedAmount, expense.amount)
      ? ExpenseStatus.REFUNDED
      : ExpenseStatus.PARTIALLY_REFUNDED;

    await this.prisma.db.expense.update({
      where: { id: expenseId },
      data: { status },
    });

    await this.audit.log({
      action: 'expense.refunded',
      entityType: 'Expense',
      entityId: expenseId,
      changes: [
        { field: 'status', old: expense.status, new: status },
        {
          field: 'refundedAmount',
          old: Money.toString(Money.sub(expense.refundedAmount, amount)),
          new: Money.toString(expense.refundedAmount),
        },
        { field: 'refundId', old: null, new: refundId },
      ],
    });
  }

  private async logDecision(
    refund: { id: string; status: RefundStatus },
    action: string,
    to: RefundStatus,
    reason?: string,
  ): Promise<void> {
    await this.audit.log({
      action: `refund.${action}`,
      entityType: 'Refund',
      entityId: refund.id,
      changes: [
        { field: 'status', old: refund.status, new: to },
        ...(reason ? [{ field: 'reason', old: null, new: reason }] : []),
      ],
    });
  }

  private async notifyBranchDirectors(
    branchId: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    const directors = await this.prisma.db.user.findMany({
      where: { role: Role.DIRECTOR, isActive: true, employee: { branchId } },
      select: { id: true },
    });

    if (directors.length > 0) {
      await this.notifications.notifyUsers(
        directors.map((d) => d.id),
        NOTIFICATION_TYPES.refundSubmitted,
        payload,
      );
      return;
    }

    await this.notifications.notifyAdmins(
      NOTIFICATION_TYPES.refundSubmitted,
      payload,
    );
  }

  private toView(row: RefundRow): RefundView {
    return {
      id: row.id,
      expenseId: row.expenseId,
      expenseGlobalNumber: row.expense.globalNumber,
      expenseBranchNumber: row.expense.branchNumber,
      branchId: row.expense.branchId,
      amount: Money.toString(row.amount),
      currency: row.currency,
      rateUsed: Money.toString(row.rateUsed, 6),
      amountUzs: Money.toString(row.amountUzs),
      reason: row.reason,
      status: row.status,
      requestedByUserId: row.requestedByUserId,
      directorApprovedByUserId: row.directorApprovedByUserId,
      adminApprovedByUserId: row.adminApprovedByUserId,
      approvedAt: row.approvedAt,
      rejectReason: row.rejectReason,
      version: row.version,
      createdAt: row.createdAt,
      files: row.files,
    };
  }

  private notFound(message = "Qaytarish so'rovi topilmadi"): NotFoundException {
    return new NotFoundException({
      statusCode: 404,
      code: 'NOT_FOUND',
      message,
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
