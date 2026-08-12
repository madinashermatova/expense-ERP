import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import { Money } from '../../common/money/money';
import { Currency, Prisma, RateSource } from '../../generated/prisma/client';
import { SettingsService } from '../settings/settings.service';
import { CbuClient } from './cbu.client';
import { NOTIFICATION_TYPES } from '../notifications/notification-types';
import { NotificationsService } from '../notifications/notifications.service';
import { unprocessable } from '../../common/errors/app-error';

export interface ResolvedRate {
  rate: Prisma.Decimal;
  source: RateSource;
  /** Kurs qaysi sanadan olingani — so'ralgan sanadan eski bo'lishi mumkin */
  rateDate: Date;
}

export interface ConversionResult {
  amountUzs: Prisma.Decimal;
  rateUsed: Prisma.Decimal;
  rateSource: RateSource;
}

export interface RateView {
  id: string;
  date: string;
  currency: Currency;
  rate: string;
  source: RateSource;
  createdAt: Date;
}

/** Sanani kun boshiga (UTC) keltiradi — kurslar kun aniqligida saqlanadi */
function atUtcMidnight(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly cbu: CbuClient,
    private readonly notifications: NotificationsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Berilgan sanaga amaldagi kursni topadi.
   *
   * Hisob bazasi sozlamadan olinadi (TZ 3.5): `AUTO` → CBU kurslari, `MANUAL` → qo'lda
   * kiritilganlar. So'ralgan sanaga aniq kurs bo'lmasa, **o'sha sanadan oldingi eng
   * yaqin** kurs ishlatiladi (dam olish kunlari va bayramlar uchun).
   */
  async resolveRate(currency: Currency, date: Date): Promise<ResolvedRate> {
    if (currency === Currency.UZS) {
      return {
        rate: Money.of(1),
        source: RateSource.MANUAL,
        rateDate: atUtcMidnight(date),
      };
    }

    const source = await this.settings.currencyBase();
    const target = atUtcMidnight(date);

    const rate = await this.prisma.db.currencyRate.findFirst({
      where: { currency, source, date: { lte: target } },
      orderBy: { date: 'desc' },
    });

    if (!rate) {
      throw unprocessable('CURRENCY_RATE_MISSING', {
        messageKey:
          source === RateSource.MANUAL
            ? 'errors.CURRENCY_RATE_MISSING_MANUAL'
            : 'errors.CURRENCY_RATE_MISSING',
        args: { date: target.toISOString().slice(0, 10) },
        details: { currency: [currency], source: [source] },
      });
    }

    return {
      rate: Money.of(rate.rate),
      source: rate.source,
      rateDate: rate.date,
    };
  }

  /**
   * TZ 3.5 — xarajat yaratilganda kurs **snapshot** qilib saqlanadi.
   * Keyin kurs o'zgarsa ham tarixiy hisobot o'zgarmaydi.
   */
  async convertToUzs(
    amount: Prisma.Decimal | string,
    currency: Currency,
    date: Date,
  ): Promise<ConversionResult> {
    const { rate, source } = await this.resolveRate(currency, date);

    return {
      amountUzs: Money.toUzs(amount, rate),
      rateUsed: Money.round6(rate),
      rateSource: source,
    };
  }

  async list(params: {
    from?: string;
    to?: string;
    currency?: Currency;
  }): Promise<RateView[]> {
    const where: Prisma.CurrencyRateWhereInput = {
      ...(params.currency ? { currency: params.currency } : {}),
      ...(params.from || params.to
        ? {
            date: {
              ...(params.from
                ? { gte: atUtcMidnight(new Date(params.from)) }
                : {}),
              ...(params.to ? { lte: atUtcMidnight(new Date(params.to)) } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.db.currencyRate.findMany({
      where,
      orderBy: [{ date: 'desc' }, { currency: 'asc' }],
      take: 400,
    });

    return rows.map((r) => this.toView(r));
  }

  /** TZ 3.5 — bosh admin sanaga kursni qo'lda kiritadi */
  async setManualRate(input: {
    date: string;
    currency: Currency;
    rate: string;
  }): Promise<RateView> {
    if (input.currency === Currency.UZS) {
      throw unprocessable('CURRENCY_NOT_CONVERTIBLE');
    }

    if (!Money.isPositive(input.rate)) {
      throw unprocessable('RATE_NOT_POSITIVE', {
        details: { rate: ["musbat bo'lishi kerak"] },
      });
    }

    const date = atUtcMidnight(new Date(input.date));
    const value = Money.round6(input.rate);

    const row = await this.prisma.db.currencyRate.upsert({
      where: {
        companyId_date_currency_source: {
          companyId: this.tenantContext.requireCompanyId(
            'CurrencyRate',
            'upsert',
          ),
          date,
          currency: input.currency,
          source: RateSource.MANUAL,
        },
      },
      create: tenantData<Prisma.CurrencyRateUncheckedCreateInput>({
        date,
        currency: input.currency,
        rate: value,
        source: RateSource.MANUAL,
        createdByUserId: this.tenantContext.userId,
      }),
      update: { rate: value, createdByUserId: this.tenantContext.userId },
    });

    return this.toView(row);
  }

  /**
   * CBU dan bitta kompaniya uchun kunlik kursni tortadi.
   *
   * TZ 3.5 — CBU mavjud bo'lmasa xato **bermaydi**: oxirgi ma'lum kurs kuchda qoladi
   * va bosh adminga ogohlantirish yuboriladi.
   */
  async syncFromCbu(
    currency: Currency,
    date: Date,
  ): Promise<{ saved: boolean; reason?: string }> {
    if (currency === Currency.UZS)
      return { saved: false, reason: 'UZS konvertatsiya qilinmaydi' };

    const fetched = await this.cbu.fetchRate(currency, date);

    if (!fetched) {
      const last = await this.prisma.db.currencyRate.findFirst({
        where: { currency, source: RateSource.AUTO },
        orderBy: { date: 'desc' },
      });

      await this.notifications.notifyAdmins(
        NOTIFICATION_TYPES.currencyRateFailed,
        {
          currency,
          date: date.toISOString().slice(0, 10),
          lastKnownRate: last?.rate.toString() ?? null,
          lastKnownDate: last?.date.toISOString().slice(0, 10) ?? null,
        },
      );

      this.logger.warn(
        `CBU kursi olinmadi (${currency}) — oxirgi ma'lum kurs kuchda qoladi`,
      );
      return { saved: false, reason: 'CBU javob bermadi' };
    }

    const day = atUtcMidnight(date);

    await this.prisma.db.currencyRate.upsert({
      where: {
        companyId_date_currency_source: {
          companyId: this.tenantContext.requireCompanyId(
            'CurrencyRate',
            'upsert',
          ),
          date: day,
          currency,
          source: RateSource.AUTO,
        },
      },
      create: tenantData<Prisma.CurrencyRateUncheckedCreateInput>({
        date: day,
        currency,
        rate: Money.round6(fetched.rate),
        source: RateSource.AUTO,
        createdByUserId: null,
      }),
      update: { rate: Money.round6(fetched.rate) },
    });

    return { saved: true };
  }

  private toView(row: {
    id: string;
    date: Date;
    currency: Currency;
    rate: Prisma.Decimal;
    source: RateSource;
    createdAt: Date;
  }): RateView {
    return {
      id: row.id,
      date: row.date.toISOString().slice(0, 10),
      currency: row.currency,
      rate: row.rate.toFixed(6),
      source: row.source,
      createdAt: row.createdAt,
    };
  }
}
