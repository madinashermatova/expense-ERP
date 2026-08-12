import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { Channel } from '../../generated/prisma/enums';
import { EXPORT_QUEUE, ExportJobData } from './export-queue';
import { ExportsService } from './exports.service';

/**
 * Fon rejimidagi eksport (TZ 3.13) — 1000 qatordan katta so'rovlar shu yerda bajariladi.
 *
 * Tenant konteksti job dan tiklanadi va **so'ragan foydalanuvchining roli hamda filiali**
 * bilan o'rnatiladi: fayl mazmuni foydalanuvchi ekranda ko'radigan doiradan chiqmasligi
 * kerak (direktor eksportida faqat o'z filiali qatorlari).
 */
@Processor(EXPORT_QUEUE)
export class ExportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportsProcessor.name);

  constructor(
    private readonly exports: ExportsService,
    private readonly tenantContext: TenantContextService,
  ) {
    super();
  }

  async process(job: Job<ExportJobData>): Promise<void> {
    const data = job.data;

    if (!data.companyId) {
      this.logger.error(`Job ${job.id}: companyId yo'q, o'tkazib yuborildi`);
      return;
    }

    await this.tenantContext.runAsync(
      {
        companyId: data.companyId,
        userId: data.userId,
        role: data.role,
        branchId: data.branchId,
        channel: Channel.SYSTEM,
      },
      async () => {
        try {
          await this.exports.generate(data.exportJobId, data.language);
        } finally {
          // Muvaffaqiyat ham, xato ham foydalanuvchiga yetkaziladi — u kutib qolmasin
          await this.exports.notifyReady(data.exportJobId, data.userId);
        }
      },
    );
  }
}
