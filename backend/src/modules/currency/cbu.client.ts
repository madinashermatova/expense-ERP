import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';

export interface CbuRate {
  currency: string;
  /** 1 birlik uchun UZS qiymati */
  rate: string;
  /** CBU e'lon qilgan sana */
  date: string;
}

interface CbuResponseItem {
  Ccy?: string;
  Rate?: string;
  Date?: string;
  Nominal?: string;
}

/**
 * cbu.uz ochiq API si (TZ 3.5).
 *
 * Format: `GET {CBU_API_URL}/{CODE}/{YYYY-MM-DD}/` →
 *   [{ "Ccy": "USD", "Rate": "12650.15", "Nominal": "1", "Date": "12.08.2026" }]
 *
 * Xatolik holatlari (tarmoq, 5xx, noto'g'ri format) `null` bilan qaytadi —
 * chaqiruvchi oxirgi ma'lum kursga tushadi va cron yiqilmaydi (TZ 3.5 qabul mezoni).
 */
@Injectable()
export class CbuClient {
  private readonly logger = new Logger(CbuClient.name);
  private readonly baseUrl: string;
  private readonly timeoutMs = 10_000;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.baseUrl = config
      .get('CBU_API_URL', { infer: true })
      .replace(/\/+$/, '');
  }

  async fetchRate(currency: string, date: Date): Promise<CbuRate | null> {
    const iso = date.toISOString().slice(0, 10);
    const url = `${this.baseUrl}/${currency}/${iso}/`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn(`CBU ${response.status} qaytardi: ${url}`);
        return null;
      }

      const data = (await response.json()) as CbuResponseItem[];
      const item = Array.isArray(data) ? data[0] : undefined;

      if (!item?.Rate) {
        this.logger.warn(`CBU javobida kurs topilmadi: ${url}`);
        return null;
      }

      // Nominal odatda 1, lekin ba'zi valyutalarda 100/1000 bo'ladi
      const nominal = Number(item.Nominal ?? '1') || 1;
      const perUnit = (Number(item.Rate) / nominal).toFixed(6);

      return {
        currency: item.Ccy ?? currency,
        rate: perUnit,
        date: item.Date ?? iso,
      };
    } catch (error) {
      this.logger.warn(
        `CBU so'rovi muvaffaqiyatsiz (${url}): ${String(error)}`,
      );
      return null;
    }
  }
}
