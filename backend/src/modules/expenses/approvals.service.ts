import { HttpException, Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { BudgetsService } from '../budgets/budgets.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BranchScopeService } from '../../common/scope/branch-scope.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { Prisma } from '../../generated/prisma/client';
import { ExpenseStatus, Role } from '../../generated/prisma/enums';
import { NOTIFICATION_TYPES } from '../notifications/notification-types';
import { NotificationsService } from '../notifications/notifications.service';
import { ExpenseAction, findTransition, Transition } from './expense-status';
import { ExpensesService, ExpenseView } from './expenses.service';
import {
  AppErrorInit,
  conflict,
  forbidden,
  notFound as notFoundError,
  unprocessable,
} from '../../common/errors/app-error';
import { TranslationService } from '../../common/i18n/translation.service';

export interface BulkApproveResult {
  approved: string[];
  failed: { id: string; code: string; message: string }[];
}

interface DecisionInput {
  action: ExpenseAction;
  reason?: string;
  version?: number;
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
    private readonly notifications: NotificationsService,
    private readonly budgets: BudgetsService,
    private readonly audit: AuditService,
    private readonly branchScope: BranchScopeService,
    private readonly tenantContext: TenantContextService,
    private readonly translations: TranslationService,
  ) {}

  approve(id: string, version?: number): Promise<ExpenseView> {
    return this.decide(id, { action: 'approve', version });
  }

  reject(id: string, reason: string, version?: number): Promise<ExpenseView> {
    return this.decide(id, { action: 'reject', reason, version });
  }

  requestFix(
    id: string,
    reason: string,
    version?: number,
  ): Promise<ExpenseView> {
    return this.decide(id, { action: 'request-fix', reason, version });
  }

  cancel(id: string): Promise<ExpenseView> {
    return this.decide(id, { action: 'cancel' });
  }

  submit(id: string): Promise<ExpenseView> {
    return this.decide(id, { action: 'submit' });
  }

  /**
   * TZ 3.7 — 20 tagacha ariza, **qisman muvaffaqiyat hisoboti bilan**.
   *
   * TZ "bitta tranzaksiyada" deydi, lekin ayni paytda bittasi yiqilganda qolganlari
   * o'tishini talab qiladi — bu ikkisi bir vaqtda bo'lolmaydi. Har bir ariza o'z
   * tranzaksiyasida qayta ishlanadi: bitta yozuvning atomikligi saqlanadi va navbatdagi
   * 19 ta ariza bittasi tufayli bekor bo'lmaydi.
   */
  async bulkApprove(ids: string[]): Promise<BulkApproveResult> {
    const result: BulkApproveResult = { approved: [], failed: [] };

    for (const id of ids) {
      try {
        await this.approve(id);
        result.approved.push(id);
      } catch (error) {
        result.failed.push({ id, ...this.describeError(error) });
      }
    }

    return result;
  }

  // ───────────────────────────────────────────────────────────────────────────

  private async decide(id: string, input: DecisionInput): Promise<ExpenseView> {
    const userId = this.tenantContext.userId;
    const role = this.tenantContext.role;
    if (!userId || !role) {
      throw forbidden('FORBIDDEN');
    }

    const expense = await this.prisma.db.expense.findUnique({
      where: { id },
      include: {
        category: { select: { receiptRequired: true, nameUz: true } },
      },
    });
    if (!expense || expense.deletedAt) throw this.notFound();

    this.branchScope.assertCanWrite(expense.branchId);

    const base = findTransition(expense.status, input.action);
    if (!base) {
      throw this.unprocessable('INVALID_STATUS_TRANSITION', {
        args: { status: expense.status },
        details: { status: [expense.status] },
      });
    }

    const transition = await this.adjustForCreator(
      base,
      expense.createdByUserId,
    );

    this.assertRole(transition, role);

    if (transition.creatorOnly && expense.createdByUserId !== userId) {
      throw forbidden('NOT_EXPENSE_OWNER');
    }

    const reason = input.reason?.trim();
    if (transition.reasonRequired && !reason) {
      throw this.unprocessable('REASON_REQUIRED');
    }

    // Chek majburiy bo'lgan kategoriyada yozuv chek bilan yuboriladi (TZ 3.6)
    if (input.action === 'submit' && expense.category.receiptRequired) {
      const fileCount = await this.prisma.db.expenseFile.count({
        where: { expenseId: expense.id },
      });
      if (fileCount === 0) {
        throw this.unprocessable('RECEIPT_REQUIRED', {
          details: { files: [expense.category.nameUz] },
        });
      }
    }

    const selfApproved =
      input.action === 'approve' &&
      transition.to === ExpenseStatus.APPROVED &&
      (await this.resolveFourEyes(expense.createdByUserId, userId));

    const data = this.buildUpdate(transition, userId, selfApproved);
    const expectedVersion = input.version ?? expense.version;

    const updated = await this.applyTransition({
      id,
      companyId: expense.companyId,
      expectedVersion,
      fromStatus: expense.status,
      transition,
      data,
      byUserId: userId,
      reason,
    });

    await this.audit.log({
      action: `expense.${input.action}`,
      entityType: 'Expense',
      entityId: id,
      changes: [
        { field: 'status', old: expense.status, new: transition.to },
        ...(reason ? [{ field: 'reason', old: null, new: reason }] : []),
        ...(selfApproved
          ? [{ field: 'selfApproved', old: false, new: true }]
          : []),
      ],
    });

    await this.notifyDecision(transition, expense, reason);

    // Yakuniy tasdiq sarfni o'zgartiradi — chegara kesib o'tilgan bo'lsa xabar ketadi (TZ 3.10)
    if (transition.to === ExpenseStatus.APPROVED) {
      await this.budgets.reevaluateForExpense(id);
    }

    return updated;
  }

  /**
   * TZ 3.7 — direktor o'zi kiritgan xarajatni o'zi tasdiqlay olmaydi, shuning uchun
   * uning arizasi 1-bosqichni butunlay o'tkazib yuboradi. Yaratishda bu `create` da
   * hal qilinadi; qoralama yoki tuzatishdan qaytgan ariza uchun esa shu yerda —
   * aks holda `NEEDS_FIX` orqali qaytgan ariza direktorning o'z navbatiga tushib qolardi.
   */
  private async adjustForCreator(
    transition: Transition,
    createdByUserId: string,
  ): Promise<Transition> {
    if (transition.to !== ExpenseStatus.DIRECTOR_PENDING) return transition;

    const creator = await this.prisma.db.user.findUnique({
      where: { id: createdByUserId },
      select: { role: true },
    });

    if (creator?.role !== Role.DIRECTOR) return transition;

    return { ...transition, to: ExpenseStatus.ADMIN_PENDING };
  }

  private assertRole(transition: Transition, role: Role): void {
    // Ro'yxat o'tishning o'zida turadi: ishchi ham `submit`/`cancel` qila oladi
    // (TZ 3.7), lekin faqat `creatorOnly` bilan cheklangan o'tishlarda.
    if (transition.roles.includes(role)) return;

    throw forbidden('STAGE_FORBIDDEN', {
      messageKey:
        transition.from === ExpenseStatus.ADMIN_PENDING
          ? 'errors.STAGE_FORBIDDEN_ADMIN'
          : 'errors.STAGE_FORBIDDEN',
    });
  }

  /**
   * Four-eyes (TZ 3.7): bosh admin o'zi kiritgan xarajatni tasdiqlay olmaydi.
   * Istisno — tizimda boshqa faol bosh admin qolmagan bo'lsa: amal o'tadi,
   * lekin yozuvda `selfApproved = true` qoladi va audit shuni ko'rsatadi.
   *
   * @returns `true` — istisno ishlatildi
   */
  private async resolveFourEyes(
    createdByUserId: string,
    userId: string,
  ): Promise<boolean> {
    if (createdByUserId !== userId) return false;

    const otherAdmins = await this.prisma.db.user.count({
      where: { role: Role.ADMIN, isActive: true, id: { not: userId } },
    });

    if (otherAdmins > 0) {
      throw forbidden('SELF_APPROVAL_FORBIDDEN');
    }

    return true;
  }

  private buildUpdate(
    transition: Transition,
    userId: string,
    selfApproved: boolean,
  ): Prisma.ExpenseUncheckedUpdateInput {
    const data: Prisma.ExpenseUncheckedUpdateInput = {
      status: transition.to,
      version: { increment: 1 },
    };

    /*
     * `submit` — yangi aylanish boshlanishi: oldingi bosqich qarorlari tozalanadi
     * (oqim 1-bosqichdan boshlanadi, TZ 3.7) va eski "kim tasdiqlagan" yozuvi
     * chalg'itmasligi kerak. Tarix `expense_status_history` da saqlanib qoladi.
     */
    if (transition.action === 'submit') {
      data.directorApprovedByUserId = null;
      data.adminApprovedByUserId = null;
      data.approvedAt = null;
      return data;
    }

    if (transition.action === 'request-fix') {
      data.directorApprovedByUserId = null;
      data.adminApprovedByUserId = null;
      data.approvedAt = null;
      return data;
    }

    if (transition.action !== 'approve') return data;

    if (transition.to === ExpenseStatus.ADMIN_PENDING) {
      data.directorApprovedByUserId = userId;
    }

    if (transition.to === ExpenseStatus.APPROVED) {
      data.adminApprovedByUserId = userId;
      data.approvedAt = new Date();
      data.selfApproved = selfApproved;
    }

    return data;
  }

  /**
   * Optimistik blokirovka (TZ 3.7): `version` va kutilgan status `WHERE` ga kiradi,
   * shuning uchun ikki tasdiqlovchidan faqat bittasi yozadi — ikkinchisi 409 oladi.
   */
  private async applyTransition(params: {
    id: string;
    companyId: string;
    expectedVersion: number;
    fromStatus: ExpenseStatus;
    transition: Transition;
    data: Prisma.ExpenseUncheckedUpdateInput;
    byUserId: string;
    reason?: string;
  }): Promise<ExpenseView> {
    const changed = await this.prisma.db.$transaction(async (tx) => {
      const { count } = await tx.expense.updateMany({
        where: {
          id: params.id,
          version: params.expectedVersion,
          status: params.fromStatus,
          deletedAt: null,
        },
        data: params.data,
      });

      if (count === 0) return false;

      await tx.expenseStatusHistory.create({
        data: {
          companyId: params.companyId,
          expenseId: params.id,
          fromStatus: params.fromStatus,
          toStatus: params.transition.to,
          byUserId: params.byUserId,
          reason: params.reason ?? null,
          channel: this.tenantContext.channel,
        },
      });

      return true;
    });

    if (!changed) {
      throw conflict('ALREADY_PROCESSED');
    }

    return this.expenses.findOne(params.id);
  }

  private async notifyDecision(
    transition: Transition,
    expense: { id: string; globalNumber: string; createdByUserId: string },
    reason?: string,
  ): Promise<void> {
    const payload = {
      expenseId: expense.id,
      globalNumber: expense.globalNumber,
      ...(reason ? { reason } : {}),
    };

    switch (transition.to) {
      case ExpenseStatus.ADMIN_PENDING:
        await this.notifications.notifyAdmins(
          NOTIFICATION_TYPES.expenseDirectorApproved,
          payload,
        );
        break;

      case ExpenseStatus.APPROVED:
        await this.notifications.notifyUsers(
          [expense.createdByUserId],
          NOTIFICATION_TYPES.expenseFinalized,
          payload,
        );
        break;

      case ExpenseStatus.REJECTED:
        await this.notifications.notifyUsers(
          [expense.createdByUserId],
          NOTIFICATION_TYPES.expenseRejected,
          payload,
        );
        break;

      case ExpenseStatus.NEEDS_FIX:
        await this.notifications.notifyUsers(
          [expense.createdByUserId],
          NOTIFICATION_TYPES.fixRequested,
          payload,
        );
        break;

      default:
        break;
    }
  }

  /**
   * Bulk hisobotida xatoni mashina o'qiydigan kodga va foydalanuvchi tilidagi
   * matnga keltiradi. Matn shu yerda tarjima qilinadi: bu javob xato emas,
   * muvaffaqiyatli javob ichidagi ro'yxat, ya'ni filter unga tegmaydi (TZ 5.4).
   */
  private describeError(error: unknown): { code: string; message: string } {
    if (error instanceof HttpException) {
      const payload = error.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        const body = payload as {
          code?: string;
          messageKey?: string;
          message?: string;
          args?: Record<string, string | number>;
        };
        const code = body.code ?? 'ERROR';
        return {
          code,
          message: this.translations.translateOr(
            body.messageKey ?? `errors.${code}`,
            body.message ?? error.message,
            { args: body.args },
          ),
        };
      }
    }

    return {
      code: 'INTERNAL_ERROR',
      message: this.translations.translateOr(
        'errors.INTERNAL_ERROR',
        'Internal error',
      ),
    };
  }

  private notFound(): HttpException {
    return notFoundError('NOT_FOUND', {
      messageKey: 'errors.EXPENSE_NOT_FOUND',
    });
  }

  private unprocessable(
    code: string,
    init: Omit<AppErrorInit, 'status'> = {},
  ): HttpException {
    return unprocessable(code, init);
  }
}
