import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  Paginated,
  paginate,
  toSkipTake,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import {
  Language,
  NotificationChannel,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { renderNotification } from './notification-messages';
import {
  NOTIFICATION_JOB,
  NOTIFICATION_JOB_OPTIONS,
  NOTIFICATION_QUEUE,
  NotificationJob,
} from './notification-queue';
export interface NotificationView {
  id: string;
  type: string;
  /** Tayyor matn — Web badge i va Telegram xabari bir xil manbadan */
  title: string;
  payload: unknown;
  channel: NotificationChannel;
  isRead: boolean;
  readAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

/**
 * Bildirishnomalar (TZ 3.11).
 *
 * Yozish **ikki qatlamli**: `Notification` yozuvi darhol bazaga tushadi (Web badge i
 * uchun), Telegram yuborish esa BullMQ navbatiga qo'yiladi. Navbat yiqilsa ham
 * foydalanuvchi xabarni Web da ko'radi — navbat yagona yetkazish yo'li emas.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue,
    private readonly tenantContext: TenantContextService,
  ) {}

  async notifyUsers(
    userIds: string[],
    type: string,
    payload: Prisma.InputJsonValue,
    channel: NotificationChannel = NotificationChannel.WEB,
  ): Promise<void> {
    if (userIds.length === 0) return;

    const companyId = this.tenantContext.requireCompanyId(
      'Notification',
      'create',
    );

    // `createManyAndReturn` — job larga id kerak, ikkinchi so'rovsiz
    const created = await this.prisma.db.notification.createManyAndReturn({
      data: userIds.map((userId) =>
        tenantData<Prisma.NotificationUncheckedCreateInput>({
          userId,
          type,
          payload,
          channel,
        }),
      ),
      select: { id: true, userId: true },
    });

    await this.enqueue(companyId, type, payload, created);
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

  /** Kontekstdan tashqarida (cron) chaqirish uchun: companyId aniq beriladi */
  async notifyAdminsOfCompany(
    companyId: string,
    type: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.tenantContext.runAsync({ companyId }, () =>
      this.notifyAdmins(type, payload),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Web ko'rinishi
  // ───────────────────────────────────────────────────────────────────────────

  async list(
    query: ListNotificationsDto,
  ): Promise<Paginated<NotificationView>> {
    const userId = this.tenantContext.userId;
    if (!userId) return paginate([], 0, 1, query.limit ?? 25);

    const { skip, take, page, limit } = toSkipTake(query);
    const where: Prisma.NotificationWhereInput = { userId };

    if (query.isRead !== undefined) {
      where.isRead = query.isRead === 'true';
    }
    if (query.type) where.type = query.type;

    const [rows, total, language] = await Promise.all([
      this.prisma.db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.db.notification.count({ where }),
      this.languageOf(userId),
    ]);

    return paginate(
      rows.map((row) => this.toView(row, language)),
      total,
      page,
      limit,
    );
  }

  async markRead(notificationId: string): Promise<void> {
    const userId = this.tenantContext.userId;

    const { count } = await this.prisma.db.notification.updateMany({
      where: { id: notificationId, userId: userId ?? undefined, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    if (count === 0) {
      // Yo'q, boshqa foydalanuvchining, yoki allaqachon o'qilgan
      const exists = await this.prisma.db.notification.count({
        where: { id: notificationId, userId: userId ?? undefined },
      });
      if (exists === 0) {
        throw new NotFoundException({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Bildirishnoma topilmadi',
        });
      }
    }
  }

  async markAllRead(): Promise<{ updated: number }> {
    const userId = this.tenantContext.userId;
    if (!userId) return { updated: 0 };

    const { count } = await this.prisma.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { updated: count };
  }

  async unreadCount(): Promise<{ count: number }> {
    const userId = this.tenantContext.userId;
    if (!userId) return { count: 0 };

    const count = await this.prisma.db.notification.count({
      where: { userId, isRead: false },
    });

    return { count };
  }

  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Job qo'shish asosiy amalni **hech qachon yiqitmaydi**: Redis ishlamasa xarajat
   * yaratish ham to'xtab qolishi mumkin bo'lardi. Web yozuvi allaqachon saqlangan,
   * shuning uchun bu yerdagi xato loglanadi va oqim davom etadi.
   */
  private async enqueue(
    companyId: string,
    type: string,
    payload: Prisma.InputJsonValue,
    created: { id: string; userId: string }[],
  ): Promise<void> {
    const data =
      payload !== null && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};

    try {
      await this.queue.addBulk(
        created.map((row) => ({
          name: NOTIFICATION_JOB,
          data: {
            companyId,
            notificationId: row.id,
            userId: row.userId,
            type,
            payload: data,
          } satisfies NotificationJob,
          opts: NOTIFICATION_JOB_OPTIONS,
        })),
      );
    } catch (error) {
      this.logger.error(
        `Bildirishnoma navbatga qo'shilmadi (${type}): ${String(error)}`,
      );
    }
  }

  private async languageOf(userId: string): Promise<Language> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    return user?.language ?? Language.UZ;
  }

  private toView(
    row: {
      id: string;
      type: string;
      payload: Prisma.JsonValue;
      channel: NotificationChannel;
      isRead: boolean;
      readAt: Date | null;
      sentAt: Date | null;
      createdAt: Date;
    },
    language: Language,
  ): NotificationView {
    return {
      id: row.id,
      type: row.type,
      title: renderNotification(row.type, row.payload, language),
      payload: row.payload,
      channel: row.channel,
      isRead: row.isRead,
      readAt: row.readAt,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
    };
  }
}
