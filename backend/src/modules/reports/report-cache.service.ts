import { createHash } from 'node:crypto';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../../config/env.validation';

/** TZ 3.13 — hisobot keshi 5 daqiqa */
const TTL_SECONDS = 300;

/**
 * Hisobot keshi (TZ 3.13).
 *
 * Kalit **har doim `companyId` bilan prefikslanadi** — kesh tenant izolyatsiyasidagi
 * eng oson buziladigan joy: bir kompaniyaning hisoboti boshqasiga ko'rinib qolsa,
 * Prisma extension bunga to'sqinlik qila olmaydi (so'rov umuman bazaga bormaydi).
 *
 * Invalidatsiya faqat TTL bilan: hisobotlar bir necha daqiqa eskirishi mumkin, lekin
 * har tasdiqlashda keshni tozalash o'nlab kalitni kuzatishni talab qilardi.
 */
@Injectable()
export class ReportCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportCacheService.name);
  private readonly redis: Redis;
  private available = true;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.redis = new Redis({
      host: config.get('REDIS_HOST', { infer: true }),
      port: config.get('REDIS_PORT', { infer: true }),
      password: config.get('REDIS_PASSWORD', { infer: true }),
      db: config.get('REDIS_DB', { infer: true }),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Kesh ixtiyoriy: Redis yo'q bo'lsa hisobot baribir ishlashi kerak
      enableOfflineQueue: false,
    });

    this.redis.on('error', () => {
      if (this.available) {
        this.available = false;
        this.logger.warn('Redis mavjud emas — hisobotlar keshsiz ishlaydi');
      }
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
      this.available = true;
    } catch {
      this.available = false;
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  /**
   * Keshdan o'qiydi, bo'lmasa `produce()` ni chaqirib natijani saqlaydi.
   * Redis xatosi hisobotni yiqitmaydi — kesh shunchaki o'tkazib yuboriladi.
   */
  async wrap<T>(
    companyId: string,
    name: string,
    filters: unknown,
    produce: () => Promise<T>,
  ): Promise<T> {
    const key = this.key(companyId, name, filters);

    if (this.available) {
      try {
        const cached = await this.redis.get(key);
        if (cached !== null) return JSON.parse(cached) as T;
      } catch {
        // jim o'tib ketamiz — pastda hisoblanadi
      }
    }

    const value = await produce();

    if (this.available) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', TTL_SECONDS);
      } catch {
        // kesh yozilmadi — muhim emas
      }
    }

    return value;
  }

  /** Testlar va sozlama o'zgarishi uchun: kompaniyaning barcha hisobot kalitlarini o'chiradi */
  async invalidate(companyId: string): Promise<void> {
    if (!this.available) return;

    try {
      const pattern = `reports:${companyId}:*`;
      const keys: string[] = [];

      // `KEYS` o'rniga `SCAN` — katta bazada Redis ni bloklamaydi
      let cursor = '0';
      do {
        const [next, batch] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          200,
        );
        cursor = next;
        keys.push(...batch);
      } while (cursor !== '0');

      if (keys.length > 0) await this.redis.del(...keys);
    } catch {
      // invalidatsiya ixtiyoriy — TTL baribir ishlaydi
    }
  }

  private key(companyId: string, name: string, filters: unknown): string {
    const hash = createHash('sha1')
      .update(JSON.stringify(filters ?? {}))
      .digest('hex')
      .slice(0, 16);

    return `reports:${companyId}:${name}:${hash}`;
  }
}
