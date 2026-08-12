import { Injectable } from '@nestjs/common';
import { Money } from '../../common/money/money';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BranchScopeService } from '../../common/scope/branch-scope.service';
import { Prisma } from '../../generated/prisma/client';
import { ExportType } from '../../generated/prisma/enums';
import { ExpensesService } from '../expenses/expenses.service';
import { ListExpensesDto } from '../expenses/dto/list-expenses.dto';
import {
  DynamicsReportDto,
  GroupedReportDto,
  ReportFilterDto,
} from '../reports/dto/report-filter.dto';
import { ReportsService } from '../reports/reports.service';
import { ExportFiltersDto } from './dto/create-export.dto';
import { MAX_EXPORT_ROWS } from './export-catalog';
import { ExportColumn, ExportDataset, ExportRow } from './export-dataset';

/** `Decimal`/string summani faylga raqam bo'lib tushadigan qiymatga aylantiradi */
function num(value: string | number | Prisma.Decimal | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function atUtcMidnight(value: string): Date {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * E1–E10 uchun ustunlar va qatorlarni tayyorlaydi (TZ 3.13).
 *
 * Ma'lumot **mavjud servislardan** olinadi (`ExpensesService`, `ReportsService`) —
 * shunda eksport ekrandagi jadval bilan bir xil filtr, bir xil filial doirasi va bir xil
 * hisoblash mantig'ini ishlatadi. Faqat servisda ekvivalenti bo'lmagan turlar (E6–E10)
 * shu yerda to'g'ridan-to'g'ri so'rov qiladi.
 */
@Injectable()
export class ExportDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
    private readonly reports: ReportsService,
    private readonly branchScope: BranchScopeService,
  ) {}

  async build(
    type: ExportType,
    filters: ExportFiltersDto,
  ): Promise<ExportDataset> {
    switch (type) {
      case ExportType.E1:
        return this.expensesList(filters);
      case ExportType.E2:
        return this.byBranch(filters);
      case ExportType.E3:
        return this.byCategory(filters);
      case ExportType.E4:
        return this.byEmployee(filters);
      case ExportType.E5:
        return this.budgetVsActual(filters);
      case ExportType.E6:
        return this.refunds(filters);
      case ExportType.E7:
        return this.employees(filters);
      case ExportType.E8:
        return this.branches();
      case ExportType.E9:
        return this.auditLog(filters);
      case ExportType.E10:
        return this.statusHistory(filters);
    }
  }

  /**
   * Qatorlar sonini oldindan baholaydi — 1000 dan katta eksport fon rejimiga o'tadi.
   *
   * Kesimli hisobotlarda (E2–E5) qatorlar soni filial/kategoriya soni bilan chegaralangan,
   * ya'ni har doim kichik: ular uchun aniq `COUNT` ortiqcha so'rov bo'lardi.
   */
  async estimateRows(
    type: ExportType,
    filters: ExportFiltersDto,
  ): Promise<number> {
    switch (type) {
      case ExportType.E1:
        return this.expenses.countForExport(this.toExpenseQuery(filters));
      case ExportType.E6:
        return this.prisma.db.refund.count({
          where: this.refundWhere(filters),
        });
      case ExportType.E7:
        return this.prisma.db.employee.count({
          where: { branchId: this.scopedBranchId(filters) ?? undefined },
        });
      case ExportType.E8:
        return this.prisma.db.branch.count();
      case ExportType.E9:
        return this.prisma.db.auditLog.count({
          where: this.auditWhere(filters),
        });
      case ExportType.E10:
        return this.prisma.db.expenseStatusHistory.count({
          where: this.historyWhere(filters),
        });
      default:
        return 0;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // E1 — xarajatlar ro'yxati
  // ───────────────────────────────────────────────────────────────────────────

  private async expensesList(
    filters: ExportFiltersDto,
  ): Promise<ExportDataset> {
    const rows = await this.expenses.listForExport(
      this.toExpenseQuery(filters),
      MAX_EXPORT_ROWS,
    );

    const columns: ExportColumn[] = [
      {
        key: 'globalNumber',
        headerUz: 'Raqam',
        headerRu: 'Номер',
        type: 'text',
        width: 14,
      },
      {
        key: 'branchNumber',
        headerUz: 'Filial raqami',
        headerRu: 'Номер филиала',
        type: 'text',
        width: 16,
      },
      {
        key: 'date',
        headerUz: 'Sana',
        headerRu: 'Дата',
        type: 'date',
        width: 12,
      },
      {
        key: 'branchName',
        headerUz: 'Filial',
        headerRu: 'Филиал',
        type: 'text',
        width: 18,
      },
      {
        key: 'categoryName',
        headerUz: 'Kategoriya',
        headerRu: 'Категория',
        type: 'text',
        width: 20,
      },
      {
        key: 'employees',
        headerUz: 'Xodimlar',
        headerRu: 'Сотрудники',
        type: 'text',
        width: 28,
      },
      {
        key: 'shares',
        headerUz: 'Taqsimlash',
        headerRu: 'Распределение',
        type: 'text',
        width: 28,
      },
      {
        key: 'amount',
        headerUz: 'Summa',
        headerRu: 'Сумма',
        type: 'money',
        width: 14,
      },
      {
        key: 'currency',
        headerUz: 'Valyuta',
        headerRu: 'Валюта',
        type: 'text',
        width: 10,
      },
      {
        key: 'rateUsed',
        headerUz: 'Kurs',
        headerRu: 'Курс',
        type: 'number',
        width: 12,
      },
      {
        key: 'amountUzs',
        headerUz: 'Summa (UZS)',
        headerRu: 'Сумма (UZS)',
        type: 'money',
        width: 16,
        total: true,
      },
      {
        key: 'refundedAmount',
        headerUz: 'Qaytarilgan',
        headerRu: 'Возвращено',
        type: 'money',
        width: 14,
      },
      {
        key: 'effectiveUzs',
        headerUz: 'Sof summa (UZS)',
        headerRu: 'Итого (UZS)',
        type: 'money',
        width: 16,
        total: true,
      },
      {
        key: 'paymentMethod',
        headerUz: "To'lov usuli",
        headerRu: 'Способ оплаты',
        type: 'text',
        width: 14,
      },
      {
        key: 'status',
        headerUz: 'Status',
        headerRu: 'Статус',
        type: 'text',
        width: 18,
      },
      {
        key: 'comment',
        headerUz: 'Izoh',
        headerRu: 'Комментарий',
        type: 'text',
        width: 30,
      },
      {
        key: 'createdByName',
        headerUz: 'Kiritdi',
        headerRu: 'Создал',
        type: 'text',
        width: 20,
      },
      {
        key: 'channel',
        headerUz: 'Kanal',
        headerRu: 'Канал',
        type: 'text',
        width: 10,
      },
      {
        key: 'createdAt',
        headerUz: 'Yaratilgan',
        headerRu: 'Создано',
        type: 'datetime',
        width: 18,
      },
    ];

    const data: ExportRow[] = rows.map((row) => ({
      globalNumber: row.globalNumber,
      branchNumber: row.branchNumber,
      date: new Date(row.date),
      branchName: row.branchName,
      categoryName: row.categoryName,
      employees: row.shares.map((s) => s.employeeName).join(', '),
      shares: row.shares
        .map((s) => `${s.employeeName}: ${s.amount}`)
        .join('; '),
      amount: num(row.amount),
      currency: row.currency,
      rateUsed: num(row.rateUsed),
      amountUzs: num(row.amountUzs),
      refundedAmount: num(row.refundedAmount),
      // Sof summa UZS da: aralash valyutali eksportda jami faqat UZS bo'yicha mantiqiy
      effectiveUzs: num(Money.toUzs(row.effectiveAmount, row.rateUsed)),
      paymentMethod: row.paymentMethod,
      status: row.status,
      comment: row.comment,
      createdByName: row.createdByName,
      channel: row.channel,
      createdAt: row.createdAt,
    }));

    return { columns, rows: data };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // E2–E5 — hisobotlar
  // ───────────────────────────────────────────────────────────────────────────

  private async byBranch(filters: ExportFiltersDto): Promise<ExportDataset> {
    const rows = await this.reports.byBranch(this.toReportQuery(filters));

    return {
      columns: [
        {
          key: 'group',
          headerUz: 'Filial',
          headerRu: 'Филиал',
          type: 'text',
          width: 24,
        },
        {
          key: 'count',
          headerUz: 'Xarajatlar soni',
          headerRu: 'Кол-во расходов',
          type: 'number',
          width: 16,
          total: true,
        },
        {
          key: 'totalAmount',
          headerUz: 'Jami (UZS)',
          headerRu: 'Итого (UZS)',
          type: 'money',
          width: 18,
          total: true,
        },
        {
          key: 'share',
          headerUz: 'Ulush, %',
          headerRu: 'Доля, %',
          type: 'number',
          width: 10,
        },
        {
          key: 'employeeCount',
          headerUz: 'Xodimlar',
          headerRu: 'Сотрудники',
          type: 'number',
          width: 12,
          total: true,
        },
        {
          key: 'avgPerEmployee',
          headerUz: "Bir xodimga o'rtacha",
          headerRu: 'Средн. на сотрудника',
          type: 'money',
          width: 20,
        },
      ],
      rows: rows.map((row) => ({
        group: row.group,
        count: row.count,
        totalAmount: num(row.totalAmount),
        share: row.share,
        employeeCount: row.employeeCount,
        avgPerEmployee: num(row.avgPerEmployee),
      })),
    };
  }

  private async byCategory(filters: ExportFiltersDto): Promise<ExportDataset> {
    const rows = await this.reports.byCategory(this.toReportQuery(filters));

    return {
      columns: [
        {
          key: 'group',
          headerUz: 'Kategoriya',
          headerRu: 'Категория',
          type: 'text',
          width: 26,
        },
        {
          key: 'count',
          headerUz: 'Xarajatlar soni',
          headerRu: 'Кол-во расходов',
          type: 'number',
          width: 16,
          total: true,
        },
        {
          key: 'totalAmount',
          headerUz: 'Jami (UZS)',
          headerRu: 'Итого (UZS)',
          type: 'money',
          width: 18,
          total: true,
        },
        {
          key: 'share',
          headerUz: 'Ulush, %',
          headerRu: 'Доля, %',
          type: 'number',
          width: 10,
        },
      ],
      rows: rows.map((row) => ({
        group: row.group,
        count: row.count,
        totalAmount: num(row.totalAmount),
        share: row.share,
      })),
    };
  }

  private async byEmployee(filters: ExportFiltersDto): Promise<ExportDataset> {
    const rows = await this.reports.byEmployee(this.toReportQuery(filters));

    return {
      columns: [
        {
          key: 'group',
          headerUz: 'Xodim',
          headerRu: 'Сотрудник',
          type: 'text',
          width: 26,
        },
        {
          key: 'branchName',
          headerUz: 'Filial',
          headerRu: 'Филиал',
          type: 'text',
          width: 20,
        },
        {
          key: 'count',
          headerUz: 'Xarajatlar soni',
          headerRu: 'Кол-во расходов',
          type: 'number',
          width: 16,
          total: true,
        },
        {
          key: 'totalAmount',
          headerUz: 'Jami (UZS)',
          headerRu: 'Итого (UZS)',
          type: 'money',
          width: 18,
          total: true,
        },
        {
          key: 'share',
          headerUz: 'Ulush, %',
          headerRu: 'Доля, %',
          type: 'number',
          width: 10,
        },
      ],
      rows: rows.map((row) => ({
        group: row.group,
        branchName: row.branchName,
        count: row.count,
        totalAmount: num(row.totalAmount),
        share: row.share,
      })),
    };
  }

  private async budgetVsActual(
    filters: ExportFiltersDto,
  ): Promise<ExportDataset> {
    const rows = await this.reports.budgetVsActual(this.toReportQuery(filters));

    return {
      columns: [
        {
          key: 'scope',
          headerUz: 'Kesim',
          headerRu: 'Разрез',
          type: 'text',
          width: 14,
        },
        {
          key: 'scopeName',
          headerUz: 'Nomi',
          headerRu: 'Название',
          type: 'text',
          width: 26,
        },
        {
          key: 'limit',
          headerUz: 'Limit (UZS)',
          headerRu: 'Лимит (UZS)',
          type: 'money',
          width: 18,
          total: true,
        },
        {
          key: 'actual',
          headerUz: 'Fakt (UZS)',
          headerRu: 'Факт (UZS)',
          type: 'money',
          width: 18,
          total: true,
        },
        {
          key: 'variance',
          headerUz: 'Farq (UZS)',
          headerRu: 'Отклонение (UZS)',
          type: 'money',
          width: 18,
          total: true,
        },
        {
          key: 'usedPercent',
          headerUz: 'Bajarilishi, %',
          headerRu: 'Использовано, %',
          type: 'number',
          width: 14,
        },
      ],
      rows: rows.map((row) => ({
        scope: row.scope,
        scopeName: row.scopeName,
        limit: num(row.limit),
        actual: num(row.actual),
        variance: num(row.variance),
        usedPercent: row.usedPercent,
      })),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // E6–E10 — ro'yxatlar va jurnallar
  // ───────────────────────────────────────────────────────────────────────────

  private async refunds(filters: ExportFiltersDto): Promise<ExportDataset> {
    const rows = await this.prisma.db.refund.findMany({
      where: this.refundWhere(filters),
      include: {
        expense: {
          select: {
            globalNumber: true,
            branchNumber: true,
            date: true,
            branch: { select: { name: true } },
            category: { select: { nameUz: true } },
          },
        },
        requestedBy: { select: { employee: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });

    return {
      columns: [
        {
          key: 'globalNumber',
          headerUz: 'Xarajat raqami',
          headerRu: 'Номер расхода',
          type: 'text',
          width: 16,
        },
        {
          key: 'branchName',
          headerUz: 'Filial',
          headerRu: 'Филиал',
          type: 'text',
          width: 18,
        },
        {
          key: 'categoryName',
          headerUz: 'Kategoriya',
          headerRu: 'Категория',
          type: 'text',
          width: 20,
        },
        {
          key: 'expenseDate',
          headerUz: 'Xarajat sanasi',
          headerRu: 'Дата расхода',
          type: 'date',
          width: 14,
        },
        {
          key: 'amount',
          headerUz: 'Qaytarish summasi',
          headerRu: 'Сумма возврата',
          type: 'money',
          width: 16,
        },
        {
          key: 'currency',
          headerUz: 'Valyuta',
          headerRu: 'Валюта',
          type: 'text',
          width: 10,
        },
        {
          key: 'amountUzs',
          headerUz: 'Summa (UZS)',
          headerRu: 'Сумма (UZS)',
          type: 'money',
          width: 16,
          total: true,
        },
        {
          key: 'status',
          headerUz: 'Status',
          headerRu: 'Статус',
          type: 'text',
          width: 18,
        },
        {
          key: 'reason',
          headerUz: 'Sabab',
          headerRu: 'Причина',
          type: 'text',
          width: 30,
        },
        {
          key: 'rejectReason',
          headerUz: 'Rad etish sababi',
          headerRu: 'Причина отказа',
          type: 'text',
          width: 26,
        },
        {
          key: 'requestedBy',
          headerUz: "So'ragan",
          headerRu: 'Запросил',
          type: 'text',
          width: 20,
        },
        {
          key: 'createdAt',
          headerUz: 'Yaratilgan',
          headerRu: 'Создано',
          type: 'datetime',
          width: 18,
        },
        {
          key: 'approvedAt',
          headerUz: 'Tasdiqlangan',
          headerRu: 'Утверждено',
          type: 'datetime',
          width: 18,
        },
      ],
      rows: rows.map((row) => ({
        globalNumber: row.expense.globalNumber,
        branchName: row.expense.branch.name,
        categoryName: row.expense.category.nameUz,
        expenseDate: row.expense.date,
        amount: num(row.amount),
        currency: row.currency,
        amountUzs: num(row.amountUzs),
        status: row.status,
        reason: row.reason,
        rejectReason: row.rejectReason,
        requestedBy: row.requestedBy.employee?.fullName ?? null,
        createdAt: row.createdAt,
        approvedAt: row.approvedAt,
      })),
    };
  }

  private async employees(filters: ExportFiltersDto): Promise<ExportDataset> {
    const branchId = this.scopedBranchId(filters);
    const rows = await this.prisma.db.employee.findMany({
      where: { ...(branchId ? { branchId } : {}) },
      include: { branch: { select: { name: true } } },
      orderBy: [{ branch: { name: 'asc' } }, { fullName: 'asc' }],
      take: MAX_EXPORT_ROWS,
    });

    return {
      columns: [
        {
          key: 'fullName',
          headerUz: 'F.I.Sh.',
          headerRu: 'Ф.И.О.',
          type: 'text',
          width: 28,
        },
        {
          key: 'position',
          headerUz: 'Lavozim',
          headerRu: 'Должность',
          type: 'text',
          width: 20,
        },
        {
          key: 'branchName',
          headerUz: 'Filial',
          headerRu: 'Филиал',
          type: 'text',
          width: 20,
        },
        {
          key: 'phone',
          headerUz: 'Telefon',
          headerRu: 'Телефон',
          type: 'text',
          width: 16,
        },
        {
          key: 'hiredAt',
          headerUz: 'Ishga qabul',
          headerRu: 'Принят',
          type: 'date',
          width: 14,
        },
        {
          key: 'status',
          headerUz: 'Status',
          headerRu: 'Статус',
          type: 'text',
          width: 12,
        },
        {
          key: 'language',
          headerUz: 'Til',
          headerRu: 'Язык',
          type: 'text',
          width: 8,
        },
      ],
      rows: rows.map((row) => ({
        fullName: row.fullName,
        position: row.position,
        branchName: row.branch.name,
        phone: row.phone,
        hiredAt: row.hiredAt,
        status: row.status,
        language: row.language,
      })),
    };
  }

  private async branches(): Promise<ExportDataset> {
    const rows = await this.prisma.db.branch.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
      take: MAX_EXPORT_ROWS,
    });

    return {
      columns: [
        {
          key: 'code',
          headerUz: 'Kod',
          headerRu: 'Код',
          type: 'text',
          width: 10,
        },
        {
          key: 'name',
          headerUz: 'Nomi',
          headerRu: 'Название',
          type: 'text',
          width: 26,
        },
        {
          key: 'address',
          headerUz: 'Manzil',
          headerRu: 'Адрес',
          type: 'text',
          width: 30,
        },
        {
          key: 'phone',
          headerUz: 'Telefon',
          headerRu: 'Телефон',
          type: 'text',
          width: 16,
        },
        {
          key: 'openedAt',
          headerUz: 'Ochilgan',
          headerRu: 'Открыт',
          type: 'date',
          width: 14,
        },
        {
          key: 'status',
          headerUz: 'Status',
          headerRu: 'Статус',
          type: 'text',
          width: 12,
        },
        {
          key: 'employeeCount',
          headerUz: 'Xodimlar',
          headerRu: 'Сотрудники',
          type: 'number',
          width: 12,
          total: true,
        },
      ],
      rows: rows.map((row) => ({
        code: row.code,
        name: row.name,
        address: row.address,
        phone: row.phone,
        openedAt: row.openedAt,
        status: row.status,
        employeeCount: row._count.employees,
      })),
    };
  }

  /**
   * E9 — audit jurnali. `changes` massivi **maydon-boyicha qatorlarga yoyiladi**
   * (TZ 3.14): bitta amalda uchta maydon o'zgargan bo'lsa, faylda uchta qator bo'ladi.
   */
  private async auditLog(filters: ExportFiltersDto): Promise<ExportDataset> {
    const rows = await this.prisma.db.auditLog.findMany({
      where: this.auditWhere(filters),
      include: {
        user: { select: { employee: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });

    const data: ExportRow[] = [];

    for (const row of rows) {
      const changes = Array.isArray(row.changes)
        ? (row.changes as { field?: string; old?: unknown; new?: unknown }[])
        : [];

      const base = {
        createdAt: row.createdAt,
        userName: row.user?.employee?.fullName ?? null,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        ip: row.ip,
        channel: row.channel,
      };

      if (changes.length === 0) {
        data.push({ ...base, field: null, oldValue: null, newValue: null });
        continue;
      }

      for (const change of changes) {
        data.push({
          ...base,
          field: change.field ?? null,
          oldValue: change.old === undefined ? null : stringify(change.old),
          newValue: change.new === undefined ? null : stringify(change.new),
        });
      }
    }

    return {
      columns: [
        {
          key: 'createdAt',
          headerUz: 'Vaqt',
          headerRu: 'Время',
          type: 'datetime',
          width: 18,
        },
        {
          key: 'userName',
          headerUz: 'Foydalanuvchi',
          headerRu: 'Пользователь',
          type: 'text',
          width: 24,
        },
        {
          key: 'action',
          headerUz: 'Amal',
          headerRu: 'Действие',
          type: 'text',
          width: 18,
        },
        {
          key: 'entityType',
          headerUz: 'Obyekt',
          headerRu: 'Объект',
          type: 'text',
          width: 16,
        },
        {
          key: 'entityId',
          headerUz: 'Obyekt ID',
          headerRu: 'ID объекта',
          type: 'text',
          width: 38,
        },
        {
          key: 'field',
          headerUz: 'Maydon',
          headerRu: 'Поле',
          type: 'text',
          width: 18,
        },
        {
          key: 'oldValue',
          headerUz: 'Eski qiymat',
          headerRu: 'Старое значение',
          type: 'text',
          width: 24,
        },
        {
          key: 'newValue',
          headerUz: 'Yangi qiymat',
          headerRu: 'Новое значение',
          type: 'text',
          width: 24,
        },
        { key: 'ip', headerUz: 'IP', headerRu: 'IP', type: 'text', width: 16 },
        {
          key: 'channel',
          headerUz: 'Kanal',
          headerRu: 'Канал',
          type: 'text',
          width: 10,
        },
      ],
      rows: data,
    };
  }

  private async statusHistory(
    filters: ExportFiltersDto,
  ): Promise<ExportDataset> {
    const rows = await this.prisma.db.expenseStatusHistory.findMany({
      where: this.historyWhere(filters),
      include: {
        expense: {
          select: {
            globalNumber: true,
            date: true,
            branch: { select: { name: true } },
          },
        },
        by: { select: { employee: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });

    return {
      columns: [
        {
          key: 'globalNumber',
          headerUz: 'Xarajat raqami',
          headerRu: 'Номер расхода',
          type: 'text',
          width: 16,
        },
        {
          key: 'branchName',
          headerUz: 'Filial',
          headerRu: 'Филиал',
          type: 'text',
          width: 18,
        },
        {
          key: 'expenseDate',
          headerUz: 'Xarajat sanasi',
          headerRu: 'Дата расхода',
          type: 'date',
          width: 14,
        },
        {
          key: 'fromStatus',
          headerUz: 'Oldingi status',
          headerRu: 'Прежний статус',
          type: 'text',
          width: 18,
        },
        {
          key: 'toStatus',
          headerUz: 'Yangi status',
          headerRu: 'Новый статус',
          type: 'text',
          width: 18,
        },
        {
          key: 'byName',
          headerUz: 'Kim',
          headerRu: 'Кто',
          type: 'text',
          width: 24,
        },
        {
          key: 'reason',
          headerUz: 'Sabab',
          headerRu: 'Причина',
          type: 'text',
          width: 30,
        },
        {
          key: 'channel',
          headerUz: 'Kanal',
          headerRu: 'Канал',
          type: 'text',
          width: 10,
        },
        {
          key: 'createdAt',
          headerUz: 'Vaqt',
          headerRu: 'Время',
          type: 'datetime',
          width: 18,
        },
      ],
      rows: rows.map((row) => ({
        globalNumber: row.expense.globalNumber,
        branchName: row.expense.branch.name,
        expenseDate: row.expense.date,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        byName: row.by.employee?.fullName ?? null,
        reason: row.reason,
        channel: row.channel,
        createdAt: row.createdAt,
      })),
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Filtrlarni so'rovlarga o'girish
  // ───────────────────────────────────────────────────────────────────────────

  /** Direktor uchun har doim o'z filiali; boshqa filial so'ralsa 403 (TZ 3.13) */
  private scopedBranchId(filters: ExportFiltersDto): string | undefined {
    return this.branchScope.resolveListFilter(filters.branchId);
  }

  private toExpenseQuery(filters: ExportFiltersDto): ListExpensesDto {
    const query = new ListExpensesDto();
    Object.assign(query, {
      branchId: filters.branchId,
      categoryId: filters.categoryId,
      employeeId: filters.employeeId,
      createdByUserId: filters.createdByUserId,
      status: filters.status,
      paymentMethod: filters.paymentMethod,
      currency: filters.currency,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      amountFrom: filters.amountFrom,
      amountTo: filters.amountTo,
      q: filters.q,
      sort: 'date',
      order: 'desc',
    });
    return query;
  }

  private toReportQuery(
    filters: ExportFiltersDto,
  ): ReportFilterDto & GroupedReportDto & DynamicsReportDto {
    return {
      period: filters.period,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      branchId: filters.branchId,
      categoryId: filters.categoryId,
      employeeId: filters.employeeId,
      paymentMethod: filters.paymentMethod,
      currency: filters.currency,
      amountFrom: filters.amountFrom,
      amountTo: filters.amountTo,
      limit: filters.limit,
    };
  }

  private dateRange(
    filters: ExportFiltersDto,
  ): { gte?: Date; lte?: Date } | undefined {
    if (!filters.dateFrom && !filters.dateTo) return undefined;
    return {
      ...(filters.dateFrom ? { gte: atUtcMidnight(filters.dateFrom) } : {}),
      // Kun oxirigacha: `createdAt` vaqt bilan saqlanadi, tun yarmidan keyingi
      // yozuvlar tushib qolmasligi kerak
      ...(filters.dateTo
        ? {
            lte: new Date(atUtcMidnight(filters.dateTo).getTime() + 86_399_999),
          }
        : {}),
    };
  }

  private refundWhere(filters: ExportFiltersDto): Prisma.RefundWhereInput {
    const branchId = this.scopedBranchId(filters);
    const createdAt = this.dateRange(filters);

    return {
      ...(createdAt ? { createdAt } : {}),
      ...(filters.currency ? { currency: filters.currency } : {}),
      ...(branchId || filters.categoryId
        ? {
            expense: {
              ...(branchId ? { branchId } : {}),
              ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
            },
          }
        : {}),
    };
  }

  private auditWhere(filters: ExportFiltersDto): Prisma.AuditLogWhereInput {
    const createdAt = this.dateRange(filters);
    return { ...(createdAt ? { createdAt } : {}) };
  }

  private historyWhere(
    filters: ExportFiltersDto,
  ): Prisma.ExpenseStatusHistoryWhereInput {
    const branchId = this.scopedBranchId(filters);
    const createdAt = this.dateRange(filters);

    return {
      ...(createdAt ? { createdAt } : {}),
      ...(branchId ? { expense: { branchId } } : {}),
    };
  }
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}
