import { HttpException, Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import {
  Paginated,
  paginate,
  toSkipTake,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BranchScopeService } from '../../common/scope/branch-scope.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import { Prisma } from '../../generated/prisma/client';
import { EditRequestStatus, Role } from '../../generated/prisma/enums';
import { ExpensesService } from '../expenses/expenses.service';
import { NOTIFICATION_TYPES } from '../notifications/notification-types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateEditRequestDto,
  ListEditRequestsDto,
} from './dto/edit-request.dto';
import { UpdateExpenseDto } from '../expenses/dto/update-expense.dto';
import {
  conflict,
  forbidden,
  notFound as notFoundError,
} from '../../common/errors/app-error';

export interface EditRequestView {
  id: string;
  expenseId: string;
  expenseGlobalNumber: string;
  expenseBranchNumber: string;
  requestedByEmployeeId: string;
  requestedBy: string;
  description: string;
  status: EditRequestStatus;
  handledByUserId: string | null;
  handledAt: Date | null;
  rejectReason: string | null;
  createdAt: Date;
}

type EditRequestRow = Prisma.EditRequestGetPayload<{
  include: {
    expense: { select: { globalNumber: true; branchNumber: true } };
    requestedBy: { select: { fullName: true } };
  };
}>;

const INCLUDE = {
  expense: { select: { globalNumber: true, branchNumber: true } },
  requestedBy: { select: { fullName: true } },
} satisfies Prisma.EditRequestInclude;

/**
 * Tahrirlash murojaatlari (TZ 3.8).
 *
 * Ishchi Web ERP ga umuman kira olmaydi, shuning uchun murojaatni amalda **bot**
 * yaratadi (S16); Web tomonida direktor va bosh admin uni ko'radi, qo'llaydi yoki
 * rad etadi. Servis kanaldan qat'i nazar bir xil ishlaydi.
 */
@Injectable()
export class EditRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly branchScope: BranchScopeService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async list(query: ListEditRequestsDto): Promise<Paginated<EditRequestView>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const where: Prisma.EditRequestWhereInput = {};

    if (query.status === 'RESOLVED') {
      where.status = {
        in: [EditRequestStatus.APPLIED, EditRequestStatus.REJECTED],
      };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.expenseId) where.expenseId = query.expenseId;

    // Direktor faqat o'z filiali xarajatlari bo'yicha murojaatlarni ko'radi
    const branchId = this.branchScope.resolveListFilter();
    if (branchId) where.expense = { branchId };

    const [rows, total] = await Promise.all([
      this.prisma.db.editRequest.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.db.editRequest.count({ where }),
    ]);

    return paginate(
      rows.map((row) => this.toView(row)),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string): Promise<EditRequestView> {
    const row = await this.prisma.db.editRequest.findUnique({
      where: { id },
      include: {
        ...INCLUDE,
        expense: {
          select: { globalNumber: true, branchNumber: true, branchId: true },
        },
      },
    });
    if (!row) throw this.notFound();

    this.branchScope.assertCanAccess(row.expense.branchId);
    return this.toView(row);
  }

  /** Murojaatni xarajat egasi (ishchi) yaratadi — amalda bot orqali */
  async create(dto: CreateEditRequestDto): Promise<EditRequestView> {
    const userId = this.tenantContext.userId;
    const user = userId
      ? await this.prisma.db.user.findUnique({
          where: { id: userId },
          select: { employeeId: true },
        })
      : null;

    const employeeId = user?.employeeId ?? null;
    if (!employeeId) {
      throw forbidden('EMPLOYEE_REQUIRED');
    }

    const expense = await this.prisma.db.expense.findUnique({
      where: { id: dto.expenseId },
      select: { id: true, branchId: true, globalNumber: true, deletedAt: true },
    });
    if (!expense || expense.deletedAt) {
      throw this.notFound('errors.EXPENSE_NOT_FOUND');
    }

    const existing = await this.prisma.db.editRequest.count({
      where: { expenseId: dto.expenseId, status: EditRequestStatus.PENDING },
    });
    if (existing > 0) {
      throw conflict('EDIT_REQUEST_PENDING');
    }

    const created = await this.prisma.db.editRequest.create({
      data: tenantData<Prisma.EditRequestUncheckedCreateInput>({
        expenseId: dto.expenseId,
        requestedByEmployeeId: employeeId,
        description: dto.description.trim(),
      }),
      include: INCLUDE,
    });

    await this.notifyApprovers(expense.branchId, {
      editRequestId: created.id,
      expenseId: expense.id,
      globalNumber: expense.globalNumber,
      description: created.description,
    });

    await this.audit.log({
      action: 'editRequest.create',
      entityType: 'EditRequest',
      entityId: created.id,
      changes: [{ field: 'description', old: null, new: created.description }],
    });

    return this.toView(created);
  }

  /**
   * Murojaatni qabul qiladi. `changes` berilsa xarajat ham shu yerda tahrirlanadi —
   * tahrirlash qoidalari (24 soatlik oyna, majburiy sabab, audit) `ExpensesService`
   * da bir joyda qoladi, bu yerda takrorlanmaydi.
   */
  async apply(
    id: string,
    changes?: UpdateExpenseDto,
  ): Promise<EditRequestView> {
    const request = await this.requirePending(id);

    if (changes) {
      await this.expenses.update(request.expenseId, changes);
    }

    return this.resolve(id, EditRequestStatus.APPLIED);
  }

  async reject(id: string, reason: string): Promise<EditRequestView> {
    await this.requirePending(id);
    return this.resolve(id, EditRequestStatus.REJECTED, reason.trim());
  }

  // ───────────────────────────────────────────────────────────────────────────

  private async requirePending(id: string) {
    const request = await this.prisma.db.editRequest.findUnique({
      where: { id },
      include: { expense: { select: { branchId: true } } },
    });
    if (!request) throw this.notFound();

    this.branchScope.assertCanWrite(request.expense.branchId);

    if (request.status !== EditRequestStatus.PENDING) {
      throw conflict('ALREADY_PROCESSED');
    }

    return request;
  }

  private async resolve(
    id: string,
    status: EditRequestStatus,
    rejectReason?: string,
  ): Promise<EditRequestView> {
    const userId = this.tenantContext.userId;

    // `updateMany` + `PENDING` sharti: ikki tasdiqlovchidan faqat bittasi yozadi
    const { count } = await this.prisma.db.editRequest.updateMany({
      where: { id, status: EditRequestStatus.PENDING },
      data: {
        status,
        handledByUserId: userId,
        handledAt: new Date(),
        rejectReason: rejectReason ?? null,
      },
    });

    if (count === 0) {
      throw conflict('ALREADY_PROCESSED');
    }

    await this.audit.log({
      action: `editRequest.${status.toLowerCase()}`,
      entityType: 'EditRequest',
      entityId: id,
      changes: [
        { field: 'status', old: EditRequestStatus.PENDING, new: status },
        ...(rejectReason
          ? [{ field: 'rejectReason', old: null, new: rejectReason }]
          : []),
      ],
    });

    const row = await this.prisma.db.editRequest.findUniqueOrThrow({
      where: { id },
      include: INCLUDE,
    });

    return this.toView(row);
  }

  /** Filial direktorlari, ular bo'lmasa bosh adminlar (TZ 3.8) */
  private async notifyApprovers(
    branchId: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    const directors = await this.prisma.db.user.findMany({
      where: {
        role: Role.DIRECTOR,
        isActive: true,
        employee: { branchId },
      },
      select: { id: true },
    });

    if (directors.length > 0) {
      await this.notifications.notifyUsers(
        directors.map((d) => d.id),
        NOTIFICATION_TYPES.editRequestSubmitted,
        payload,
      );
      return;
    }

    await this.notifications.notifyAdmins(
      NOTIFICATION_TYPES.editRequestSubmitted,
      payload,
    );
  }

  private toView(row: EditRequestRow): EditRequestView {
    return {
      id: row.id,
      expenseId: row.expenseId,
      expenseGlobalNumber: row.expense.globalNumber,
      expenseBranchNumber: row.expense.branchNumber,
      requestedByEmployeeId: row.requestedByEmployeeId,
      requestedBy: row.requestedBy.fullName,
      description: row.description,
      status: row.status,
      handledByUserId: row.handledByUserId,
      handledAt: row.handledAt,
      rejectReason: row.rejectReason,
      createdAt: row.createdAt,
    };
  }

  /** `messageKey` — bir xil kod turli kontekstda boshqacha o'qiladi (TZ 5.4) */
  private notFound(
    messageKey = 'errors.NOT_FOUND_EDIT_REQUEST',
  ): HttpException {
    return notFoundError('NOT_FOUND', { messageKey });
  }
}
