import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { Channel } from '../../generated/prisma/enums';
import { NotificationTextService } from './notification-messages';
import { NOTIFICATION_QUEUE, NotificationJob } from './notification-queue';
import { TelegramSenderService } from './telegram-sender.service';

/**
 * Bildirishnoma navbati processori (TZ 3.11).
 *
 * Web yozuvi allaqachon `NotificationsService` da yaratilgan — bu yerda faqat
 * **Telegram yuborish** bajariladi. Shu sababli navbat yiqilsa ham foydalanuvchi
 * xabarni Web badge ida ko'radi: navbat yagona yetkazish yo'li emas.
 *
 * Xatolik yuqoriga chiqariladi — BullMQ 3 marta eksponensial backoff bilan qayta
 * uriniadi, keyin job `failed` holatida qoladi va log yoziladi.
 */
@Processor(NOTIFICATION_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramSenderService,
    private readonly tenantContext: TenantContextService,
    private readonly texts: NotificationTextService,
  ) {
    super();
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    const data = job.data;

    if (!data.companyId) {
      // Kontekstsiz job — qayta urinish yordam bermaydi
      this.logger.error(`Job ${job.id}: companyId yo'q, o'tkazib yuborildi`);
      return;
    }

    if (!this.telegram.enabled) return;

    // Processor so'rov tashqarisida ishlaydi — tenant kontekstini job dan tiklaymiz
    await this.tenantContext.runAsync(
      { companyId: data.companyId, channel: Channel.SYSTEM },
      () => this.deliver(job, data),
    );
  }

  private async deliver(
    job: Job<NotificationJob>,
    data: NotificationJob,
  ): Promise<void> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: data.userId },
      select: {
        language: true,
        isActive: true,
        employeeId: true,
        telegramLinks: {
          where: { isRevoked: false, expiresAt: { gt: new Date() } },
          select: { telegramId: true },
        },
      },
    });

    if (!user || !user.isActive || user.telegramLinks.length === 0) return;

    const text = this.texts.render(data.type, data.payload, user.language);
    let delivered = false;

    for (const link of user.telegramLinks) {
      const result = await this.telegram.send(link.telegramId, text);

      if (result.botBlocked) {
        await this.markBotBlocked(user.employeeId);
        continue;
      }

      if (result.sent) delivered = true;
    }

    if (delivered) {
      await this.prisma.db.notification.updateMany({
        where: { id: data.notificationId },
        data: { sentAt: new Date() },
      });
    }

    this.logger.debug(
      `Job ${job.id}: ${delivered ? 'yuborildi' : 'yetkazilmadi'} (${data.type})`,
    );
  }

  /**
   * TZ 3.11 — bloklangan bot xato bermaydi: xodim kartochkasida belgi qoladi va
   * job muvaffaqiyatli yakunlanadi (qayta urinish befoyda).
   */
  private async markBotBlocked(employeeId: string | null): Promise<void> {
    if (!employeeId) return;

    await this.prisma.db.employee.updateMany({
      where: { id: employeeId },
      data: { botBlocked: true },
    });
  }
}
