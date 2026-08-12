import { HttpException, Injectable } from '@nestjs/common';
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
  Role,
} from '../../generated/prisma/enums';
import { BudgetsService, BudgetWarning } from '../budgets/budgets.service';
import { CurrencyService } from '../currency/currency.service';
import { FilesService, FileView } from '../files/files.service';
import { NOTIFICATION_TYPES } from '../notifications/notification-types';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateExpenseDto, ExpenseShareDto } from './dto/create-expense.dto';
import {
  EXPENSE_SORT_FIELDS,
  ExpenseSortField,
  ListExpensesDto,
} from './dto/list-expenses.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { SPEND_COUNTED_STATUSES } from './expense-status';
import { NumberingService } from './numbering.service';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import {
  AppErrorInit,
  conflict,
  forbidden,
  notFound as notFoundError,
  unprocessable,
} from '../../common/errors/app-error';

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
  /** Limit yumshoq: oshib ketsa ham yozuv yaratiladi, faqat ogohlantiriladi (TZ 3.10) */
  budgetWarning?: BudgetWarning[];
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
    private readonly budgets: BudgetsService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Yaratish
  // ───────────────────────────────────────────────────────────────────────────

  async create(dto: CreateExpenseDto): Promise<CreateExpenseResult> {
    const companyId = this.tenantContext.requireCompanyId('Expense', 'create');
    const userId = this.tenantContext.userId;
    if (!userId) {
      throw forbidden('FORBIDDEN');
    }

    const amount = Money.round2(dto.amount);
    if (!Money.isPositive(amount)) {
      throw this.unprocessable('AMOUNT_NOT_POSITIVE', {
        details: { amount: [dto.amount] },
      });
    }

    const date = atUtcMidnight(dto.date);
    if (date.getTime() > atUtcMidnight(new Date()).getTime()) {
      throw this.unprocessable('DATE_IN_FUTURE', {
        details: { date: [dto.date] },
      });
    }

    this.branchScope.assertCanWrite(dto.branchId);

    const branch = await this.prisma.db.branch.findUnique({
      where: { id: dto.branchId },
    });
    if (!branch) throw this.notFound('errors.BRANCH_NOT_FOUND');
    if (branch.status !== BranchStatus.ACTIVE) {
      throw this.unprocessable('BRANCH_ARCHIVED', {
        details: { branchId: [dto.branchId] },
      });
    }

    const category = await this.prisma.db.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw this.notFound('errors.CATEGORY_NOT_FOUND');
    if (category.status !== CategoryStatus.ACTIVE) {
      throw this.unprocessable('CATEGORY_ARCHIVED', {
        details: { categoryId: [dto.categoryId] },
      });
    }

    if (category.commentRequired && !dto.comment?.trim()) {
      throw this.unprocessable('COMMENT_REQUIRED', {
        details: { comment: [category.nameUz] },
      });
    }

    if (
      category.maxAmountPerEntry !== null &&
      amount.greaterThan(category.maxAmountPerEntry)
    ) {
      throw this.unprocessable('CATEGORY_LIMIT_EXCEEDED', {
        args: { limit: Money.toString(category.maxAmountPerEntry) },
        details: { amount: [Money.toString(amount)] },
      });
    }

    await this.loadEmployees(dto.employeeIds, dto.branchId);
    const shares = this.resolveShares(amount, dto.employeeIds, dto.shares);

    const status = this.initialStatus(category.receiptRequired);

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

    await this.notifyApprovers(created);

    /*
     * Yangi yozuv hali `APPROVED` emas, ya'ni sarfda hisoblanmaydi. Shunga qaramay
     * foydalanuvchiga "bu xarajat limitdan oshiradi" deb aytish kerak (TZ 3.10), shuning
     * uchun summasi `extraUzs` sifatida qo'shib baholanadi. Bildirishnoma bu yerda
     * yuborilmaydi — u sarf haqiqatan o'zgarganda, ya'ni yakuniy tasdiqda ketadi.
     */
    const warnings = await this.budgets.evaluate({
      branchId: branch.id,
      categoryId: category.id,
      employeeIds: dto.employeeIds,
      date,
      extraUzs: conversion.amountUzs,
    });
    if (warnings.length > 0) view.budgetWarning = warnings;

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

  /**
   * Eksport uchun qatorlar — sahifalashsiz (TZ 3.13 E1).
   *
   * Ro'yxat bilan **bir xil** filtr va filial doirasi ishlatiladi: eksportdagi qatorlar
   * soni ekrandagi natija bilan aynan mos kelishi kerak, shuning uchun bu yerda alohida
   * so'rov qurilmaydi.
   */
  async listForExport(
    query: ListExpensesDto,
    take: number,
  ): Promise<ExpenseView[]> {
    const branchId = this.branchScope.resolveListFilter(query.branchId);
    const rows = await this.prisma.db.expense.findMany({
      where: this.buildWhere(query, branchId),
      include: EXPENSE_INCLUDE,
      orderBy: this.buildOrderBy(query),
      take,
    });

    return rows.map((row) => this.toView(row));
  }

  /** Eksportni fon rejimiga o'tkazish kerakligini aniqlash uchun (TZ 3.13) */
  async countForExport(query: ListExpensesDto): Promise<number> {
    const branchId = this.branchScope.resolveListFilter(query.branchId);
    return this.prisma.db.expense.count({
      where: this.buildWhere(query, branchId),
    });
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
      throw this.unprocessable('NO_FILES');
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
      throw this.notFound('errors.FILE_NOT_FOUND');
    }

    await this.files.removeExpenseFile(fileId);

    await this.audit.log({
      action: 'expense.files.remove',
      entityType: 'Expense',
      entityId: expense.id,
      changes: [{ field: 'file', old: file.originalName, new: null }],
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Tahrirlash (TZ 3.8)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Tasdiqlangan xarajatni tahrirlash — `approvedAt` dan boshlab
   * `expense.editWindowHours` (sukut 24 soat) ichida. Qaror chiqmagan yozuvlar
   * (`DRAFT`, `DIRECTOR_PENDING`, `NEEDS_FIX`) oynasiz tahrirlanadi.
   *
   * `ADMIN_PENDING` ataylab tahrirlanmaydi: direktor qarori allaqachon chiqqan va
   * uni jimgina o'zgartirish tasdiqlashning ma'nosini yo'qotardi — buning uchun
   * `request-fix` bor.
   */
  async update(id: string, dto: UpdateExpenseDto): Promise<ExpenseView> {
    const userId = this.tenantContext.userId;
    const reason = dto.reason.trim();

    const expense = await this.prisma.db.expense.findUnique({
      where: { id },
      include: { shares: true },
    });
    if (!expense || expense.deletedAt) throw this.notFound();

    this.branchScope.assertCanWrite(expense.branchId);
    await this.assertEditable(expense.status, expense.approvedAt);

    const category = dto.categoryId
      ? await this.requireActiveCategory(dto.categoryId)
      : null;

    const amount = dto.amount ? Money.round2(dto.amount) : expense.amount;
    if (!Money.isPositive(amount)) {
      throw this.unprocessable('AMOUNT_NOT_POSITIVE', {
        details: { amount: [dto.amount ?? ''] },
      });
    }

    const date = dto.date ? atUtcMidnight(dto.date) : expense.date;
    if (date.getTime() > atUtcMidnight(new Date()).getTime()) {
      throw this.unprocessable('DATE_IN_FUTURE', {
        details: { date: [dto.date ?? ''] },
      });
    }

    const currency = dto.currency ?? expense.currency;
    const effectiveCategory =
      category ??
      (await this.prisma.db.category.findUniqueOrThrow({
        where: { id: expense.categoryId },
      }));

    if (effectiveCategory.commentRequired) {
      const comment = dto.comment !== undefined ? dto.comment : expense.comment;
      if (!comment?.trim()) {
        throw this.unprocessable('COMMENT_REQUIRED', {
          details: { comment: [effectiveCategory.nameUz] },
        });
      }
    }

    if (
      effectiveCategory.maxAmountPerEntry !== null &&
      amount.greaterThan(effectiveCategory.maxAmountPerEntry)
    ) {
      throw this.unprocessable('CATEGORY_LIMIT_EXCEEDED', {
        args: { limit: Money.toString(effectiveCategory.maxAmountPerEntry) },
        details: { amount: [Money.toString(amount)] },
      });
    }

    // Qaytarilgan summadan pastga tushib ketmasin (DB check constraint ham bor)
    if (amount.lessThan(expense.refundedAmount)) {
      throw this.unprocessable('AMOUNT_BELOW_REFUNDED', {
        args: { refunded: Money.toString(expense.refundedAmount) },
        details: { amount: [Money.toString(amount)] },
      });
    }

    /*
     * Kurs snapshot i faqat **kirish ma'lumoti o'zgarganda** qayta hisoblanadi:
     * valyuta yoki sana tuzatilgan bo'lsa asl snapshot noto'g'ri kirishga tayangan edi.
     * Faqat summa o'zgarsa eski kurs saqlanadi — TZ 3.5 tarixiy kursni muzlatadi.
     */
    const rateChanged =
      (dto.currency !== undefined && dto.currency !== expense.currency) ||
      (dto.date !== undefined && date.getTime() !== expense.date.getTime());

    const conversion = rateChanged
      ? await this.currency.convertToUzs(amount, currency, date)
      : {
          amountUzs: Money.toUzs(amount, expense.rateUsed),
          rateUsed: expense.rateUsed,
          rateSource: expense.rateSource,
        };

    const employeeIds =
      dto.employeeIds ?? expense.shares.map((share) => share.employeeId);
    if (dto.employeeIds) {
      await this.loadEmployees(dto.employeeIds, expense.branchId);
    }

    const sharesChanged =
      dto.employeeIds !== undefined ||
      dto.shares !== undefined ||
      !Money.equals(amount, expense.amount) ||
      rateChanged;

    const shares = sharesChanged
      ? this.resolveShares(amount, employeeIds, dto.shares)
      : null;

    const before = {
      categoryId: expense.categoryId,
      amount: Money.toString(expense.amount),
      currency: expense.currency,
      amountUzs: Money.toString(expense.amountUzs),
      date: expense.date.toISOString().slice(0, 10),
      comment: expense.comment,
      paymentMethod: expense.paymentMethod,
    };
    const after = {
      categoryId: effectiveCategory.id,
      amount: Money.toString(amount),
      currency,
      amountUzs: Money.toString(conversion.amountUzs),
      date: date.toISOString().slice(0, 10),
      comment:
        dto.comment !== undefined
          ? dto.comment.trim() || null
          : expense.comment,
      paymentMethod: dto.paymentMethod ?? expense.paymentMethod,
    };

    const updated = await this.prisma.db.$transaction(async (tx) => {
      if (shares) {
        await tx.expenseShare.deleteMany({ where: { expenseId: id } });
        await tx.expenseShare.createMany({
          data: shares.map((share) => ({
            companyId: expense.companyId,
            expenseId: id,
            employeeId: share.employeeId,
            amount: share.amount,
            amountUzs: Money.toUzs(share.amount, conversion.rateUsed),
          })),
        });
      }

      return tx.expense.update({
        where: { id },
        data: {
          categoryId: after.categoryId,
          amount,
          currency,
          rateUsed: conversion.rateUsed,
          rateSource: conversion.rateSource,
          amountUzs: conversion.amountUzs,
          date,
          comment: after.comment,
          paymentMethod: after.paymentMethod,
          version: { increment: 1 },
        },
        include: EXPENSE_INCLUDE,
      });
    });

    await this.audit.log({
      action: 'expense.update',
      entityType: 'Expense',
      entityId: id,
      changes: [
        ...this.audit.diff(before, after),
        { field: 'reason', old: null, new: reason },
      ],
    });

    /*
     * TZ 3.8 — summa tahrirlansa limit ogohlantirishlari qayta baholanadi.
     * Sarfning o'zi so'rov vaqtida hisoblanadi, shuning uchun qayta hisoblash shart emas;
     * lekin tahrir yozuvni chegaradan **o'tkazib yuborishi** mumkin va bu holda xabar
     * ketishi kerak. Faqat sarfga kiradigan statuslar uchun — hali tasdiqlanmagan yozuv
     * sarfga ta'sir qilmaydi.
     */
    if (SPEND_COUNTED_STATUSES.includes(expense.status)) {
      await this.budgets.reevaluateForExpense(id);
    }

    // Tahrirlash ham status tarixida iz qoldiradi — sabab shu yerda saqlanadi
    await this.prisma.db.expenseStatusHistory.create({
      data: {
        companyId: expense.companyId,
        expenseId: id,
        fromStatus: expense.status,
        toStatus: expense.status,
        byUserId: userId!,
        reason,
        channel: this.tenantContext.channel,
      },
    });

    return this.toView(updated);
  }

  /** Tahrirlash oynasi ochiqmi (TZ 3.8) */
  private async assertEditable(
    status: ExpenseStatus,
    approvedAt: Date | null,
  ): Promise<void> {
    const editableWithoutWindow: ExpenseStatus[] = [
      ExpenseStatus.DRAFT,
      ExpenseStatus.DIRECTOR_PENDING,
      ExpenseStatus.NEEDS_FIX,
    ];
    if (editableWithoutWindow.includes(status)) return;

    if (status !== ExpenseStatus.APPROVED) {
      throw this.unprocessable('EXPENSE_NOT_EDITABLE', {
        args: { status },
        details: { status: [status] },
      });
    }

    const { hours } = await this.settings.get<{ hours: number }>(
      SETTING_KEYS.expenseEditWindowHours,
    );
    const deadline = new Date(
      (approvedAt ?? new Date()).getTime() + hours * 3_600_000,
    );

    if (Date.now() > deadline.getTime()) {
      throw this.unprocessable('EDIT_WINDOW_CLOSED', {
        details: { approvedAt: [deadline.toISOString()] },
      });
    }
  }

  private async requireActiveCategory(categoryId: string) {
    const category = await this.prisma.db.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw this.notFound('errors.CATEGORY_NOT_FOUND');
    if (category.status !== CategoryStatus.ACTIVE) {
      throw this.unprocessable('CATEGORY_ARCHIVED', {
        details: { categoryId: [categoryId] },
      });
    }
    return category;
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
      throw this.conflict('ALREADY_DELETED');
    }

    // Tasdiqlangan yoki qaytarilgan xarajat moliyaviy tarixning bir qismi —
    // uni o'chirish o'rniga bekor qilish (S7) yoki qaytarish (S9) ishlatiladi.
    if (
      expense.status === ExpenseStatus.APPROVED ||
      expense.status === ExpenseStatus.PARTIALLY_REFUNDED ||
      expense.status === ExpenseStatus.REFUNDED
    ) {
      throw this.conflict('EXPENSE_NOT_DELETABLE');
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

  /**
   * Yangi xarajat haqida navbatdagi tasdiqlovchiga xabar (TZ 3.11).
   *
   * `DRAFT` da xabar yuborilmaydi — yozuv hali tugallanmagan va `submit` dan keyin
   * tasdiqlash oqimiga tushadi, o'sha yerda xabar ketadi.
   */
  private async notifyApprovers(expense: ExpenseRow): Promise<void> {
    if (expense.status === ExpenseStatus.DRAFT) return;

    const payload = {
      expenseId: expense.id,
      globalNumber: expense.globalNumber,
      amount: Money.toString(expense.amount),
    };

    // Direktor kiritgan ariza darhol 2-bosqichda bo'ladi (TZ 3.7)
    if (expense.status === ExpenseStatus.ADMIN_PENDING) {
      await this.notifications.notifyAdmins(
        NOTIFICATION_TYPES.expenseCreated,
        payload,
      );
      return;
    }

    const directors = await this.prisma.db.user.findMany({
      where: {
        role: Role.DIRECTOR,
        isActive: true,
        employee: { branchId: expense.branchId },
      },
      select: { id: true },
    });

    if (directors.length === 0) {
      // Filialda direktor yo'q — ariza baribir ko'rilishi kerak
      await this.notifications.notifyAdmins(
        NOTIFICATION_TYPES.expenseCreated,
        payload,
      );
      return;
    }

    await this.notifications.notifyUsers(
      directors.map((d) => d.id),
      NOTIFICATION_TYPES.expenseCreated,
      payload,
    );
  }

  /**
   * Yangi yozuv qaysi statusda tug'iladi.
   *
   * - Isbot majburiy bo'lgan kategoriya (TZ 3.6): fayl JSON tanasi bilan birga kela
   *   olmaydi, shuning uchun yozuv `DRAFT` da qoladi va chek yuklangach
   *   `POST /expenses/:id/submit` uni oqimga uzatadi. Raqamlar baribir yaratilishda
   *   beriladi — TZ ularni "yaratilganda" talab qiladi.
   * - Direktor o'zi kiritgan xarajatni o'zi tasdiqlay olmaydi (TZ 3.7), shuning uchun
   *   1-bosqich o'tkazib yuboriladi va yozuv to'g'ridan-to'g'ri `ADMIN_PENDING` bo'ladi.
   */
  private initialStatus(receiptRequired: boolean): ExpenseStatus {
    if (receiptRequired) return ExpenseStatus.DRAFT;
    return this.tenantContext.role === Role.DIRECTOR
      ? ExpenseStatus.ADMIN_PENDING
      : ExpenseStatus.DIRECTOR_PENDING;
  }

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
      throw this.conflict('EXPENSE_LOCKED');
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
      throw this.unprocessable('DUPLICATE_EMPLOYEE', {
        details: { employeeIds },
      });
    }

    const employees = await this.prisma.db.employee.findMany({
      where: { id: { in: unique } },
    });

    if (employees.length !== unique.length) {
      throw this.unprocessable('EMPLOYEE_NOT_FOUND', {
        details: {
          employeeIds: unique.filter(
            (id) => !employees.some((e) => e.id === id),
          ),
        },
      });
    }

    const wrongBranch = employees.filter((e) => e.branchId !== branchId);
    if (wrongBranch.length > 0) {
      throw this.unprocessable('EMPLOYEE_WRONG_BRANCH', {
        details: { employeeIds: wrongBranch.map((e) => e.id) },
      });
    }

    const inactive = employees.filter(
      (e) => e.status !== EmployeeStatus.ACTIVE,
    );
    if (inactive.length > 0) {
      throw this.unprocessable('EMPLOYEE_INACTIVE', {
        details: { employeeIds: inactive.map((e) => e.id) },
      });
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
      throw this.unprocessable('SHARES_MISMATCH', {
        details: { shares: employeeIds },
      });
    }

    const shares = manual.map((s) => ({
      employeeId: s.employeeId,
      amount: Money.round2(s.amount),
    }));

    for (const share of shares) {
      if (!Money.isPositive(share.amount)) {
        throw this.unprocessable('SHARE_NOT_POSITIVE', {
          details: { shares: [share.employeeId] },
        });
      }
    }

    const total = Money.sum(shares.map((s) => s.amount));
    if (!Money.equals(total, amount)) {
      throw this.unprocessable('SHARES_SUM_MISMATCH', {
        args: { total: Money.toString(total), amount: Money.toString(amount) },
        details: { shares: [Money.toString(total)] },
      });
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

  /** `messageKey` — bir xil kod turli kontekstda boshqacha o'qiladi (TZ 5.4) */
  private notFound(messageKey = 'errors.EXPENSE_NOT_FOUND'): HttpException {
    return notFoundError('NOT_FOUND', { messageKey });
  }

  private unprocessable(
    code: string,
    init: Omit<AppErrorInit, 'status'> = {},
  ): HttpException {
    return unprocessable(code, init);
  }

  private conflict(
    code: string,
    init: Omit<AppErrorInit, 'status'> = {},
  ): HttpException {
    return conflict(code, init);
  }
}
