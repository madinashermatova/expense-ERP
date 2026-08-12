import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { cronDisabled } from '../../common/cron/cron.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import {
  Channel,
  CompanyStatus,
  ExpenseStatus,
  Role,
} from '../../generated/prisma/enums';
import { NOTIFICATION_TYPES } from '../notifications/notification-types';
import { NotificationsService } from '../notifications/notifications.service';
import { SETTING_KEYS, SettingsService } from '../settings/settings.service';
import { PENDING_STATUSES } from './expense-status';

/** Bitta ishga tushirishda ko'riladigan eng ko'p ariza — cron uzoq ishlab qolmasligi uchun */
const BATCH_LIMIT = 500;

/**
 * TZ 3.7 — belgilangan muddat (sukut bo'yicha 24 soat) ichida ko'rilmagan ariza
 * bo'yicha tasdiqlovchiga eslatma yuboriladi.
 *
 * Takroriy eslatma yuborilmasligi uchun mavjud `APPROVAL_REMINDER` bildirishnomalari
 * tekshiriladi — sxemada alohida `reminderSentAt` maydoni yo'q va uni faqat shu
 * funksiya uchun qo'shish ortiqcha bo'lardi.
 */
@Injectable()
export class ApprovalReminderCron {
  private readonly logger = new Logger(ApprovalReminderCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'approval-reminder' })
  async runHourly(): Promise<void> {
    if (cronDisabled()) return;
    await this.run(new Date());
  }

  /** Qo'lda ishga tushirish va testlar uchun ochiq */
  async run(now: Date): Promise<{ companies: number; reminded: number }> {
    const companies = await this.tenantContext.runUnscoped(
      'cron: faol kompaniyalar',
      () =>
        this.prisma.raw.company.findMany({
          where: { status: CompanyStatus.ACTIVE },
          select: { id: true, name: true },
        }),
    );

    let reminded = 0;

    for (const company of companies) {
      try {
        reminded += await this.tenantContext.runAsync(
          { companyId: company.id, channel: Channel.SYSTEM },
          () => this.remindCompany(now),
        );
      } catch (error) {
        // Bitta kompaniyadagi xatolik butun cron ni to'xtatmaydi
        this.logger.error(
          `Eslatma yuborilmadi (${company.name}): ${String(error)}`,
        );
      }
    }

    if (reminded > 0) {
      this.logger.log(`Tasdiqlash eslatmalari: ${reminded} ta ariza`);
    }

    return { companies: companies.length, reminded };
  }

  private async remindCompany(now: Date): Promise<number> {
    const { hours } = await this.settings.get<{ hours: number }>(
      SETTING_KEYS.approvalReminderHours,
    );
    const threshold = new Date(now.getTime() - hours * 3_600_000);

    const pending = await this.prisma.db.expense.findMany({
      where: {
        status: { in: [...PENDING_STATUSES] },
        deletedAt: null,
        // Oxirgi status o'zgarishi emas, yaratilish vaqti: ariza navbatda qancha turgani
        createdAt: { lte: threshold },
      },
      select: {
        id: true,
        globalNumber: true,
        branchId: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_LIMIT,
    });

    if (pending.length === 0) return 0;

    const alreadySent = await this.alreadyReminded(pending.map((e) => e.id));
    const targets = pending.filter((e) => !alreadySent.has(e.id));
    if (targets.length === 0) return 0;

    const approvers = await this.approversByBranch(targets);

    let sent = 0;
    for (const expense of targets) {
      const userIds =
        expense.status === ExpenseStatus.ADMIN_PENDING
          ? approvers.admins
          : (approvers.directors.get(expense.branchId) ?? approvers.admins);

      if (userIds.length === 0) continue;

      await this.notifications.notifyUsers(
        userIds,
        NOTIFICATION_TYPES.approvalReminder,
        {
          expenseId: expense.id,
          globalNumber: expense.globalNumber,
          status: expense.status,
          waitingHours: hours,
        },
      );
      sent += 1;
    }

    return sent;
  }

  /**
   * Ushbu arizalar bo'yicha eslatma allaqachon yuborilganmi.
   *
   * Raw so'rov ataylab: Prisma ning JSON filtri `path` bo'yicha `in` ni qo'llab-quvvatlamaydi,
   * shusiz esa kompaniyaning **barcha** eslatmalarini xotiraga tortishga to'g'ri kelardi.
   * `companyId` shartga qo'lda qo'shilgan — raw so'rov tenant extension dan o'tmaydi.
   */
  private async alreadyReminded(expenseIds: string[]): Promise<Set<string>> {
    const companyId = this.tenantContext.requireCompanyId(
      'Notification',
      'read',
    );

    const rows = await this.prisma.db.$queryRaw<{ expenseId: string }[]>`
      SELECT DISTINCT payload->>'expenseId' AS "expenseId"
        FROM "notifications"
       WHERE "companyId" = ${companyId}
         AND "type" = ${NOTIFICATION_TYPES.approvalReminder}
         AND payload->>'expenseId' = ANY(${expenseIds}::text[])
    `;

    return new Set(rows.map((r) => r.expenseId));
  }

  /** 1-bosqich uchun filial direktorlari, 2-bosqich uchun bosh adminlar */
  private async approversByBranch(
    expenses: { branchId: string; status: ExpenseStatus }[],
  ): Promise<{ admins: string[]; directors: Map<string, string[]> }> {
    const branchIds = [...new Set(expenses.map((e) => e.branchId))];

    const [admins, directors] = await Promise.all([
      this.prisma.db.user.findMany({
        where: { role: Role.ADMIN, isActive: true },
        select: { id: true },
      }),
      this.prisma.db.user.findMany({
        where: {
          role: Role.DIRECTOR,
          isActive: true,
          employee: { branchId: { in: branchIds } },
        },
        select: { id: true, employee: { select: { branchId: true } } },
      }),
    ]);

    const byBranch = new Map<string, string[]>();
    for (const director of directors) {
      const branchId = director.employee?.branchId;
      if (!branchId) continue;
      byBranch.set(branchId, [...(byBranch.get(branchId) ?? []), director.id]);
    }

    return { admins: admins.map((a) => a.id), directors: byBranch };
  }
}
