import {
  BadRequestException,
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
import { Money, splitEqually } from '../../common/money/money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BranchScopeService } from '../../common/scope/branch-scope.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import { Prisma } from '../../generated/prisma/client';
import {
  BranchStatus,
  CategoryStatus,
  Currency,
  EmployeeStatus,
  ExpenseStatus,
  PaymentMethod,
  RateSource,
} from '../../generated/prisma/enums';
import { CurrencyService } from '../currency/currency.service';
import { FilesService, FileView } from '../files/files.service';
import { CreateExpenseDto, ExpenseShareDto } from './dto/create-expense.dto';
import {
  EXPENSE_SORT_FIELDS,
  ExpenseSortField,
  ListExpensesDto,
} from './dto/list-expenses.dto';
import { NumberingService } from './numbering.service';

/** Dublikat ogohlantirish oynasi (TZ 3.6) — bloklamaydi, faqat ogohlantiradi */
const DUPLICATE_WINDOW_MINUTES = 10;

export interface ExpenseShareView {
  employeeId: string;
  employeeName: string;
  amount: string;
  amountUzs: string;
}

export interface ExpenseView {
  id: string;
  globalNumber: string;
  branchNumber: string;
  branchId: string;
  branchName: string;
  categoryId: string;
  categoryName: string;
  amount: string;
  currency: Currency;
  rateUsed: string;
  rateSource: RateSource;
  amountUzs: string;
  refundedAmount: string;
  /** Qaytarilgandan keyingi haqiqiy summa */
  effectiveAmount: string;
  date: string;
  comment: string | null;
  paymentMethod: PaymentMethod;
  status: ExpenseStatus;
  createdByUserId: string;
  createdByName: string | null;
  channel: string;
  version: number;
  deletedAt: Date | null;
  createdAt: Date;
  shares: ExpenseShareView[];
  files?: FileView[];
}

export interface CreateExpenseResult extends ExpenseView {
  /** Yaqin 10 daqiqada shunga o'xshash yozuv bo'lsa to'ldiriladi (bloklamaydi) */
  duplicateWarning?: { expenseId: string; globalNumber: string };
}

type ExpenseRow = Prisma.ExpenseGetPayload<{
  include: {
    branch: { select: { id: true; name: true; code: true } };
    category: { select: { id: true; nameUz: true } };
    createdBy: {
      select: { id: true; employee: { select: { fullName: true } } };
    };
    shares: {
      include: { employee: { select: { id: true; fullName: true } } };
    };
  };
}>;

const EXPENSE_INCLUDE = {
  branch: { select: { id: true, name: true, code: true } },
  category: { select: { id: true, nameUz: true } },
  createdBy: { select: { id: true, employee: { select: { fullName: true } } } },
  // Barqaror tartib: aks holda Postgres ulushlarni ixtiyoriy tartibda qaytaradi
  shares: {
    include: { employee: { select: { id: true, fullName: true } } },
    orderBy: { employee: { fullName: 'asc' } },
  },
} satisfies Prisma.ExpenseInclude;

/** Sanani kun boshiga (UTC) keltiradi — `date` ustuni DATE tipida */
function atUtcMidnight(value: string | Date): Date {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
    private readonly numbering: NumberingService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
    private readonly branchScope: BranchScopeService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Yaratish
  // ───────────────────────────────────────────────────────────────────────────

  async create(dto: CreateExpenseDto): Promise<CreateExpenseResult> {
    const companyId = this.tenantContext.requireCompanyId('Expense', 'create');
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Foydalanuvchi aniqlanmadi',
      });
    }

    const amount = Money.round2(dto.amount);
    if (!Money.isPositive(amount)) {
      throw this.unprocessable(
        'AMOUNT_NOT_POSITIVE',
        "Summa noldan katta bo'lishi kerak",
        { amount: [dto.amount] },
      );
    }

    const date = atUtcMidnight(dto.date);
    if (date.getTime() > atUtcMidnight(new Date()).getTime()) {
      throw this.unprocessable(
        'DATE_IN_FUTURE',
        'Kelajakdagi sana bilan xarajat kiritib bo‘lmaydi',
        { date: [dto.date] },
      );
    }

    this.branchScope.assertCanWrite(dto.branchId);

    const branch = await this.prisma.db.branch.findUnique({
      where: { id: dto.branchId },
    });
    if (!branch) throw this.notFound('Filial topilmadi');
    if (branch.status !== BranchStatus.ACTIVE) {
      throw this.unprocessable(
        'BRANCH_ARCHIVED',
        'Arxivlangan filialga xarajat kiritib bo‘lmaydi',
        { branchId: [dto.branchId] },
      );
    }

    const category = await this.prisma.db.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw this.notFound('Kategoriya topilmadi');
    if (category.status !== CategoryStatus.ACTIVE) {
      throw this.unprocessable(
        'CATEGORY_ARCHIVED',
        'Arxivlangan kategoriyaga xarajat kiritib bo‘lmaydi',
        { categoryId: [dto.categoryId] },
      );
    }

    if (category.commentRequired && !dto.comment?.trim()) {
      throw this.unprocessable(
        'COMMENT_REQUIRED',
        'Bu kategoriya uchun izoh majburiy',
        { comment: [category.nameUz] },
      );
    }

    if (
      category.maxAmountPerEntry !== null &&
      amount.greaterThan(category.maxAmountPerEntry)
    ) {
      throw this.unprocessable(
        'CATEGORY_LIMIT_EXCEEDED',
        `Bu kategoriya uchun bir martalik chegara ${Money.toString(category.maxAmountPerEntry)}`,
        { amount: [Money.toString(amount)] },
      );
    }

    await this.loadEmployees(dto.employeeIds, dto.branchId);
    const shares = this.resolveShares(amount, dto.employeeIds, dto.shares);

    /*
     * Isbot majburiy bo'lgan kategoriya (TZ 3.6): fayl JSON tanasi bilan birga kela
     * olmaydi, shuning uchun yozuv `DRAFT` da tug'iladi va `POST /expenses/:id/submit`
     * chekni tekshirib tasdiqlash oqimiga uzatadi. Raqamlar baribir shu yerda beriladi —
     * TZ ularni "yaratilganda" talab qiladi va keyin hech qachon o'zgarmaydi.
     */
    const status = category.receiptRequired
      ? ExpenseStatus.DRAFT
      : ExpenseStatus.DIRECTOR_PENDING;

    // Kurs snapshot i — keyin kurs o'zgarsa ham bu xarajat o'zgarmaydi (TZ 3.5)
    const conversion = await this.currency.convertToUzs(
      amount,
      dto.currency,
      date,
    );

    const duplicate = await this.findRecentDuplicate({
      categoryId: dto.categoryId,
      amount,
      date,
      employeeIds: dto.employeeIds,
    });

    const created = await this.prisma.db.$transaction(async (tx) => {
      const numbers = await this.numbering.nextForExpense(tx, {
        companyId,
        branchId: branch.id,
        branchCode: branch.code,
        date,
      });

      return tx.expense.create({
        data: tenantData<Prisma.ExpenseUncheckedCreateInput>({
          globalNumber: numbers.globalNumber,
          branchNumber: numbers.branchNumber,
          branchSeqYear: numbers.branchSeqYear,
          branchSeq: numbers.branchSeq,
          branchId: branch.id,
          categoryId: category.id,
          amount,
          currency: dto.currency,
          rateUsed: conversion.rateUsed,
          rateSource: conversion.rateSource,
          amountUzs: conversion.amountUzs,
          date,
          comment: dto.comment?.trim() || null,
          paymentMethod: dto.paymentMethod,
          createdByUserId: userId,
          channel: this.tenantContext.channel,
          status,
          shares: {
            create: shares.map((share) => ({
              companyId,
              employeeId: share.employeeId,
              amount: share.amount,
              // Ulushning UZS ekvivalenti ham aynan shu snapshot kursida
              amountUzs: Money.toUzs(share.amount, conversion.rateUsed),
            })),
          },
          statusHistory: {
            create: {
              companyId,
              fromStatus: null,
              toStatus: status,
              byUserId: userId,
              channel: this.tenantContext.channel,
            },
          },
        }),
        include: EXPENSE_INCLUDE,
      });
    });

    await this.audit.log({
      action: 'expense.create',
      entityType: 'Expense',
      entityId: created.id,
      changes: [
        { field: 'globalNumber', old: null, new: created.globalNumber },
        { field: 'branchNumber', old: null, new: created.branchNumber },
        { field: 'amount', old: null, new: Money.toString(created.amount) },
      ],
    });

    const view: CreateExpenseResult = this.toView(created);
    if (duplicate) {
      view.duplicateWarning = {
        expenseId: duplicate.id,
        globalNumber: duplicate.globalNumber,
      };
    }
    return view;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // O'qish
  // ───────────────────────────────────────────────────────────────────────────

  async list(query: ListExpensesDto): Promise<Paginated<ExpenseView>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const branchId = this.branchScope.resolveListFilter(query.branchId);
    const where = this.buildWhere(query, branchId);

    const [rows, total] = await Promise.all([
      this.prisma.db.expense.findMany({
        where,
        include: EXPENSE_INCLUDE,
        orderBy: this.buildOrderBy(query),
        skip,
        take,
      }),
      this.prisma.db.expense.count({ where }),
    ]);

    return paginate(
      rows.map((row) => this.toView(row)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<ExpenseView> {
    const expense = await this.prisma.db.expense.findUnique({
      where: { id },
      include: EXPENSE_INCLUDE,
    });
    if (!expense) throw this.notFound();

    this.branchScope.assertCanAccess(expense.branchId);

    const view = this.toView(expense);
    view.files = await this.files.listForExpense(expense.id);
    return view;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Fayllar va tasdiqlash oqimiga uzatish
  // ───────────────────────────────────────────────────────────────────────────

  async attachFiles(
    id: string,
    files: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }[],
  ): Promise<FileView[]> {
    const userId = this.tenantContext.userId;
    const expense = await this.requireEditable(id);

    if (files.length === 0) {
      throw this.unprocessable('NO_FILES', 'Fayl yuborilmadi');
    }

    const saved = await this.files.attachToExpense(expense.id, files, userId!);

    await this.audit.log({
      action: 'expense.files.attach',
      entityType: 'Expense',
      entityId: expense.id,
      changes: saved.map((f) => ({
        field: 'file',
        old: null,
        new: f.originalName,
      })),
    });

    return saved;
  }

  async removeFile(id: string, fileId: string): Promise<void> {
    const expense = await this.requireEditable(id);

    const file = await this.prisma.db.expenseFile.findUnique({
      where: { id: fileId },
    });
    if (!file || file.expenseId !== expense.id) {
      throw this.notFound('Fayl topilmadi');
    }

    await this.files.removeExpenseFile(fileId);

    await this.audit.log({
      action: 'expense.files.remove',
      entityType: 'Expense',
      entityId: expense.id,
      changes: [{ field: 'file', old: file.originalName, new: null }],
    });
  }

  /**
   * `DRAFT` dan tasdiqlash oqimiga uzatadi. Isbot majburiy bo'lgan kategoriyada
   * kamida bitta fayl bo'lishi shart (TZ 3.6).
   */
  async submit(id: string): Promise<ExpenseView> {
    const userId = this.tenantContext.userId;
    const expense = await this.prisma.db.expense.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!expense || expense.deletedAt) throw this.notFound();

    this.branchScope.assertCanWrite(expense.branchId);

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw this.unprocessable(
        'INVALID_STATUS_TRANSITION',
        'Faqat qoralama holatidagi xarajatni yuborish mumkin',
        { status: [expense.status] },
      );
    }

    if (expense.category.receiptRequired) {
      const fileCount = await this.prisma.db.expenseFile.count({
        where: { expenseId: expense.id },
      });
      if (fileCount === 0) {
        throw this.unprocessable(
          'RECEIPT_REQUIRED',
          'Bu kategoriya uchun chek yoki kvitansiya majburiy',
          { files: [expense.category.nameUz] },
        );
      }
    }

    const updated = await this.prisma.db.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.DIRECTOR_PENDING,
        statusHistory: {
          create: {
            companyId: expense.companyId,
            fromStatus: ExpenseStatus.DRAFT,
            toStatus: ExpenseStatus.DIRECTOR_PENDING,
            byUserId: userId!,
            channel: this.tenantContext.channel,
          },
        },
      },
      include: EXPENSE_INCLUDE,
    });

    await this.audit.log({
      action: 'expense.submit',
      entityType: 'Expense',
      entityId: id,
      changes: [
        {
          field: 'status',
          old: ExpenseStatus.DRAFT,
          new: ExpenseStatus.DIRECTOR_PENDING,
        },
      ],
    });

    return this.toView(updated);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // O'chirish (soft delete)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * TZ 3.6 — xarajat hech qachon fizik o'chirilmaydi: `deletedAt` to'ldiriladi va
   * audit jurnaliga yozuv qo'shiladi.
   */
  async remove(id: string): Promise<void> {
    const userId = this.tenantContext.userId;
    const expense = await this.prisma.db.expense.findUnique({ where: { id } });
    if (!expense) throw this.notFound();

    this.branchScope.assertCanWrite(expense.branchId);

    if (expense.deletedAt) {
      throw this.conflict('ALREADY_DELETED', "Xarajat allaqachon o'chirilgan");
    }

    // Tasdiqlangan yoki qaytarilgan xarajat moliyaviy tarixning bir qismi —
    // uni o'chirish o'rniga bekor qilish (S7) yoki qaytarish (S9) ishlatiladi.
    if (
      expense.status === ExpenseStatus.APPROVED ||
      expense.status === ExpenseStatus.PARTIALLY_REFUNDED ||
      expense.status === ExpenseStatus.REFUNDED
    ) {
      throw this.conflict(
        'EXPENSE_NOT_DELETABLE',
        "Tasdiqlangan xarajatni o'chirib bo‘lmaydi",
      );
    }

    await this.prisma.db.expense.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId },
    });

    await this.audit.log({
      action: 'expense.delete',
      entityType: 'Expense',
      entityId: id,
      changes: [
        { field: 'deletedAt', old: null, new: new Date().toISOString() },
      ],
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Ichki yordamchilar
  // ───────────────────────────────────────────────────────────────────────────

  /** Fayl qo'shish/olib tashlash faqat yozuv hali yakunlanmagan bo'lsa mumkin */
  private async requireEditable(id: string) {
    const expense = await this.prisma.db.expense.findUnique({ where: { id } });
    if (!expense || expense.deletedAt) throw this.notFound();

    this.branchScope.assertCanWrite(expense.branchId);

    const editable: ExpenseStatus[] = [
      ExpenseStatus.DRAFT,
      ExpenseStatus.DIRECTOR_PENDING,
      ExpenseStatus.ADMIN_PENDING,
      ExpenseStatus.NEEDS_FIX,
    ];
    if (!editable.includes(expense.status)) {
      throw this.conflict(
        'EXPENSE_LOCKED',
        'Yakunlangan xarajat fayllarini o‘zgartirib bo‘lmaydi',
      );
    }

    return expense;
  }

  /**
   * Xodimlar mavjud, faol va **o'sha filialga tegishli** bo'lishi kerak —
   * aks holda ulush boshqa filial hisobotiga oqib ketardi.
   */
  private async loadEmployees(employeeIds: string[], branchId: string) {
    const unique = [...new Set(employeeIds)];
    if (unique.length !== employeeIds.length) {
      throw this.unprocessable(
        'DUPLICATE_EMPLOYEE',
        'Bitta xodim ro‘yxatda ikki marta ko‘rsatilgan',
        { employeeIds },
      );
    }

    const employees = await this.prisma.db.employee.findMany({
      where: { id: { in: unique } },
    });

    if (employees.length !== unique.length) {
      throw this.unprocessable('EMPLOYEE_NOT_FOUND', 'Xodim topilmadi', {
        employeeIds: unique.filter((id) => !employees.some((e) => e.id === id)),
      });
    }

    const wrongBranch = employees.filter((e) => e.branchId !== branchId);
    if (wrongBranch.length > 0) {
      throw this.unprocessable(
        'EMPLOYEE_WRONG_BRANCH',
        'Xodim tanlangan filialga tegishli emas',
        { employeeIds: wrongBranch.map((e) => e.id) },
      );
    }

    const inactive = employees.filter(
      (e) => e.status !== EmployeeStatus.ACTIVE,
    );
    if (inactive.length > 0) {
      throw this.unprocessable(
        'EMPLOYEE_INACTIVE',
        'Nofaol xodimga xarajat taqsimlab bo‘lmaydi',
        { employeeIds: inactive.map((e) => e.id) },
      );
    }

    return employees;
  }

  /**
   * Taqsimlash (TZ 3.6): `shares` berilmasa teng bo'linadi (qoldiq tiyin birinchi
   * xodimga), berilsa yig'indi umumiy summaga **aniq** teng bo'lishi shart.
   */
  private resolveShares(
    amount: Prisma.Decimal,
    employeeIds: string[],
    manual?: ExpenseShareDto[],
  ): { employeeId: string; amount: Prisma.Decimal }[] {
    if (!manual || manual.length === 0) {
      const parts = splitEqually(amount, employeeIds.length);
      return employeeIds.map((employeeId, index) => ({
        employeeId,
        amount: parts[index],
      }));
    }

    const given = new Set(manual.map((s) => s.employeeId));
    if (
      given.size !== manual.length ||
      given.size !== employeeIds.length ||
      !employeeIds.every((id) => given.has(id))
    ) {
      throw this.unprocessable(
        'SHARES_MISMATCH',
        'Ulushlar ro‘yxati tanlangan xodimlarga mos kelmadi',
        { shares: employeeIds },
      );
    }

    const shares = manual.map((s) => ({
      employeeId: s.employeeId,
      amount: Money.round2(s.amount),
    }));

    for (const share of shares) {
      if (!Money.isPositive(share.amount)) {
        throw this.unprocessable(
          'SHARE_NOT_POSITIVE',
          "Har bir ulush noldan katta bo'lishi kerak",
          { shares: [share.employeeId] },
        );
      }
    }

    const total = Money.sum(shares.map((s) => s.amount));
    if (!Money.equals(total, amount)) {
      throw this.unprocessable(
        'SHARES_SUM_MISMATCH',
        `Ulushlar yig'indisi (${Money.toString(total)}) umumiy summaga (${Money.toString(amount)}) teng emas`,
        { shares: [Money.toString(total)] },
      );
    }

    return shares;
  }

  /** Bir xil xodim + kategoriya + summa + sana, 10 daqiqa ichida (TZ 3.6) */
  private async findRecentDuplicate(params: {
    categoryId: string;
    amount: Prisma.Decimal;
    date: Date;
    employeeIds: string[];
  }): Promise<{ id: string; globalNumber: string } | null> {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60_000);

    return this.prisma.db.expense.findFirst({
      where: {
        categoryId: params.categoryId,
        amount: params.amount,
        date: params.date,
        deletedAt: null,
        createdAt: { gte: since },
        shares: { some: { employeeId: { in: params.employeeIds } } },
      },
      select: { id: true, globalNumber: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildWhere(
    query: ListExpensesDto,
    branchId?: string,
  ): Prisma.ExpenseWhereInput {
    const where: Prisma.ExpenseWhereInput = {};

    if (query.includeDeleted !== 'true') where.deletedAt = null;
    if (branchId) where.branchId = branchId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.createdByUserId) where.createdByUserId = query.createdByUserId;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.currency) where.currency = query.currency;
    if (query.status?.length) where.status = { in: query.status };
    if (query.employeeId) {
      where.shares = { some: { employeeId: query.employeeId } };
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {
        ...(query.dateFrom ? { gte: atUtcMidnight(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: atUtcMidnight(query.dateTo) } : {}),
      };
    }

    if (query.amountFrom || query.amountTo) {
      where.amountUzs = {
        ...(query.amountFrom ? { gte: Money.round2(query.amountFrom) } : {}),
        ...(query.amountTo ? { lte: Money.round2(query.amountTo) } : {}),
      };
    }

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { globalNumber: { contains: q, mode: 'insensitive' } },
        { branchNumber: { contains: q, mode: 'insensitive' } },
        { comment: { contains: q, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private buildOrderBy(
    query: ListExpensesDto,
  ): Prisma.ExpenseOrderByWithRelationInput[] {
    const field = EXPENSE_SORT_FIELDS.includes(query.sort as ExpenseSortField)
      ? (query.sort as ExpenseSortField)
      : 'date';
    const order = query.order ?? 'desc';

    // Ikkinchi mezon barqaror tartib uchun — bir xil sanadagi yozuvlar
    // sahifalar orasida sakrab yurmasligi kerak
    return field === 'globalNumber'
      ? [{ globalNumber: order }]
      : [{ [field]: order }, { globalNumber: 'desc' }];
  }

  private toView(row: ExpenseRow): ExpenseView {
    return {
      id: row.id,
      globalNumber: row.globalNumber,
      branchNumber: row.branchNumber,
      branchId: row.branchId,
      branchName: row.branch.name,
      categoryId: row.categoryId,
      categoryName: row.category.nameUz,
      amount: Money.toString(row.amount),
      currency: row.currency,
      rateUsed: Money.toString(row.rateUsed, 6),
      rateSource: row.rateSource,
      amountUzs: Money.toString(row.amountUzs),
      refundedAmount: Money.toString(row.refundedAmount),
      effectiveAmount: Money.toString(
        Money.sub(row.amount, row.refundedAmount),
      ),
      date: row.date.toISOString().slice(0, 10),
      comment: row.comment,
      paymentMethod: row.paymentMethod,
      status: row.status,
      createdByUserId: row.createdByUserId,
      createdByName: row.createdBy.employee?.fullName ?? null,
      channel: row.channel,
      version: row.version,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      shares: row.shares.map((share) => ({
        employeeId: share.employeeId,
        employeeName: share.employee.fullName,
        amount: Money.toString(share.amount),
        amountUzs: Money.toString(share.amountUzs),
      })),
    };
  }

  private notFound(message = 'Xarajat topilmadi'): NotFoundException {
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

  private conflict(code: string, message: string): BadRequestException {
    return new BadRequestException({ statusCode: 409, code, message });
  }
}
