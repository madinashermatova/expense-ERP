import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import {
  Channel,
  CompanyStatus,
  Currency,
} from '../../generated/prisma/client';
import { CurrencyService } from './currency.service';

/**
 * TZ 3.5 — kuniga bir marta CBU dan kurs tortiladi (09:00 Asia/Tashkent).
 *
 * Kurs har bir kompaniya uchun alohida yoziladi (`CurrencyRate.companyId`), shuning uchun
 * CBU dan bir marta olingan qiymat barcha faol kompaniyalarga tarqatiladi.
 * Bitta kompaniyada xatolik bo'lsa qolganlari to'xtamaydi.
 */
@Injectable()
export class CurrencyCron {
  private readonly logger = new Logger(CurrencyCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly currency: CurrencyService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Cron('0 9 * * *', { name: 'currency-daily', timeZone: 'Asia/Tashkent' })
  async syncDaily(): Promise<void> {
    await this.runFor(new Date());
  }

  /** Qo'lda ishga tushirish va testlar uchun ochiq */
  async runFor(
    date: Date,
  ): Promise<{ companies: number; saved: number; failed: number }> {
    const companies = await this.tenantContext.runUnscoped(
      'cron: faol kompaniyalar',
      () =>
        this.prisma.raw.company.findMany({
          where: { status: CompanyStatus.ACTIVE },
          select: { id: true, name: true },
        }),
    );

    let saved = 0;
    let failed = 0;

    for (const company of companies) {
      try {
        const result = await this.tenantContext.runAsync(
          { companyId: company.id, channel: Channel.SYSTEM },
          () => this.currency.syncFromCbu(Currency.USD, date),
        );
        if (result.saved) saved += 1;
        else failed += 1;
      } catch (error) {
        // Bitta kompaniyadagi xatolik butun cron ni to'xtatmaydi (TZ 3.5 qabul mezoni)
        failed += 1;
        this.logger.error(
          `Kurs sinxronizatsiyasi xatosi (${company.name}): ${String(error)}`,
        );
      }
    }

    this.logger.log(
      `Kurs sinxronizatsiyasi: ${companies.length} kompaniya, ${saved} saqlandi, ${failed} muvaffaqiyatsiz`,
    );

    return { companies: companies.length, saved, failed };
  }
}
