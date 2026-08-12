import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { cronDisabled } from '../../common/cron/cron.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { ExportStatus } from '../../generated/prisma/enums';
import { StorageService } from '../files/storage.service';

/** Bitta ishga tushirishda tozalanadigan eng ko'p fayl */
const BATCH_LIMIT = 500;

/**
 * TZ 3.13 — eksport fayli 24 soatdan keyin storagedan avtomatik o'chiriladi.
 *
 * Yozuvning o'zi bazada qoladi (eksport tarixi va audit uchun), faqat `storageKey`
 * bo'shatiladi: shundan keyin `GET /exports/:id/download` "muddati tugagan" deb javob
 * beradi va foydalanuvchi qayta so'raydi.
 *
 * Cron tenant filtridan tashqarida ishlaydi: muddati o'tgan fayl qaysi kompaniyaniki
 * bo'lishidan qat'i nazar o'chirilishi kerak, kalitning o'zi esa `{companyId}/` bilan
 * prefikslangan — noto'g'ri katalogga tegib ketish imkoni yo'q.
 */
@Injectable()
export class ExportCleanupCron {
  private readonly logger = new Logger(ExportCleanupCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'export-cleanup' })
  async runHourly(): Promise<void> {
    if (cronDisabled()) return;
    await this.run(new Date());
  }

  /** Qo'lda ishga tushirish va testlar uchun ochiq */
  async run(now: Date): Promise<{ removed: number }> {
    const expired = await this.tenantContext.runUnscoped(
      'cron: muddati tugagan eksport fayllari',
      () =>
        this.prisma.raw.exportJob.findMany({
          where: {
            status: ExportStatus.DONE,
            storageKey: { not: null },
            expiresAt: { lte: now },
          },
          select: { id: true, storageKey: true },
          take: BATCH_LIMIT,
        }),
    );

    let removed = 0;

    for (const job of expired) {
      try {
        if (job.storageKey) await this.storage.remove(job.storageKey);
      } catch (error) {
        // Storage da fayl allaqachon yo'q bo'lishi mumkin — yozuvni baribir bo'shatamiz
        this.logger.warn(
          `Eksport fayli o'chirilmadi (${job.storageKey ?? '—'}): ${String(error)}`,
        );
      }

      await this.tenantContext.runUnscoped(
        "cron: eksport kalitini bo'shatish",
        () =>
          this.prisma.raw.exportJob.update({
            where: { id: job.id },
            data: { storageKey: null },
          }),
      );

      removed += 1;
    }

    if (removed > 0) {
      this.logger.log(`Muddati tugagan eksport fayllari: ${removed} ta`);
    }

    return { removed };
  }
}
