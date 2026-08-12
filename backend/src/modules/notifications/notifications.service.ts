import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import {
  NotificationChannel,
  Prisma,
  Role,
} from '../../generated/prisma/client';

/** TZ 3.11 — bildirishnoma turlari */
export const NOTIFICATION_TYPES = {
  currencyRateFailed: 'CURRENCY_RATE_FAILED',
  expenseCreated: 'EXPENSE_CREATED',
  expenseDirectorApproved: 'EXPENSE_DIRECTOR_APPROVED',
  expenseFinalized: 'EXPENSE_FINALIZED',
  expenseRejected: 'EXPENSE_REJECTED',
  fixRequested: 'FIX_REQUESTED',
  editRequestSubmitted: 'EDIT_REQUEST_SUBMITTED',
  refundSubmitted: 'REFUND_SUBMITTED',
  refundResolved: 'REFUND_RESOLVED',
  budgetThreshold: 'BUDGET_THRESHOLD',
  approvalReminder: 'APPROVAL_REMINDER',
} as const;

/**
 * Bildirishnomalarning yozuv qatlami (TZ 3.11).
 *
 * Hozircha faqat Web kanali: yozuv bazaga tushadi va o'qilmaganlar hisoblagichida
 * ko'rinadi. BullMQ navbati va Telegram yuborish S11 da shu servis ustiga qo'shiladi —
 * chaqiruvchi kod o'zgarmaydi.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async notifyUsers(
    userIds: string[],
    type: string,
    payload: Prisma.InputJsonValue,
    channel: NotificationChannel = NotificationChannel.WEB,
  ): Promise<void> {
    if (userIds.length === 0) return;

    await this.prisma.db.notification.createMany({
      data: userIds.map((userId) =>
        tenantData<Prisma.NotificationUncheckedCreateInput>({
          userId,
          type,
          payload,
          channel,
        }),
      ),
    });
  }

  /** Kompaniyaning barcha faol bosh adminlariga */
  async notifyAdmins(
    type: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    const admins = await this.prisma.db.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });

    await this.notifyUsers(
      admins.map((a) => a.id),
      type,
      payload,
    );
  }

  /**
   * Kontekstdan tashqarida (cron) chaqirish uchun: companyId aniq beriladi.
   */
  async notifyAdminsOfCompany(
    companyId: string,
    type: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.tenantContext.runAsync({ companyId }, () =>
      this.notifyAdmins(type, payload),
    );
  }

  async markRead(notificationId: string): Promise<void> {
    await this.prisma.db.notification.updateMany({
      where: {
        id: notificationId,
        userId: this.tenantContext.userId ?? undefined,
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async unreadCount(): Promise<number> {
    const userId = this.tenantContext.userId;
    if (!userId) return 0;
    return this.prisma.db.notification.count({
      where: { userId, isRead: false },
    });
  }
}
