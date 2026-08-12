import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EnvironmentVariables } from '../../config/env.validation';
import { Language } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';
import { FlowState } from './flow-state';

export interface BotSession {
  botId: string;
  telegramId: bigint;
  activeLinkId: string | null;
  language: Language;
  flow: FlowState | null;
}

/**
 * Bot sessiyasi (TZ 3.12.3, 3.16.5).
 *
 * Kalit `bot:{botId}:{telegramId}` — TZ da aynan shu shakl talab qilingan. Redis
 * operativ saqlash: oqim har qadamda yoziladi va bot qayta ishga tushsa yo'qolmaydi.
 *
 * Nega yonma-yon DB ham bor: Redis tozalangan (yoki umuman ko'tarilmagan) holatda
 * ham `activeLinkId` va til saqlanishi shart — ular bildirishnoma yuborishda bot
 * jarayonidan tashqarida ham kerak bo'ladi. Ikkalasi **bitta funksiyada** yoziladi
 * (`save`), ya'ni ikki manba bir-biridan ajralib ketolmaydi; o'qishda Redis birinchi,
 * u bo'sh bo'lsa DB dan tiklanadi.
 */
@Injectable()
export class BotSessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotSessionService.name);
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  private redisAvailable = true;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.ttlSeconds =
      config.get('TELEGRAM_SESSION_DAYS', { infer: true }) * 24 * 60 * 60;

    this.redis = new Redis({
      host: config.get('REDIS_HOST', { infer: true }),
      port: config.get('REDIS_PORT', { infer: true }),
      password: config.get('REDIS_PASSWORD', { infer: true }),
      db: config.get('REDIS_DB', { infer: true }),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Redis yo'q bo'lsa bot ishlashda davom etadi — holat DB dan o'qiladi
      enableOfflineQueue: false,
    });

    this.redis.on('error', () => {
      if (this.redisAvailable) {
        this.redisAvailable = false;
        this.logger.warn('Redis mavjud emas — bot sessiyasi DB dan ishlaydi');
      }
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.redis.connect();
      this.redisAvailable = true;
    } catch {
      this.redisAvailable = false;
    }
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  key(botId: string, telegramId: bigint): string {
    return `bot:${botId}:${String(telegramId)}`;
  }

  async load(botId: string, telegramId: bigint): Promise<BotSession> {
    const cached = await this.readCache(botId, telegramId);
    if (cached) return cached;

    // `TelegramSession` tenant allow-list ida — kontekstsiz o'qish xavfsiz
    const row = await this.prisma.db.telegramSession.findUnique({
      where: { telegramId_botId: { telegramId, botId } },
    });

    const session: BotSession = {
      botId,
      telegramId,
      activeLinkId: row?.activeLinkId ?? null,
      language: row?.language ?? Language.UZ,
      flow: (row?.flowState as FlowState | null) ?? null,
    };

    await this.writeCache(session);
    return session;
  }

  async save(session: BotSession): Promise<void> {
    await this.prisma.db.telegramSession.upsert({
      where: {
        telegramId_botId: {
          telegramId: session.telegramId,
          botId: session.botId,
        },
      },
      create: {
        telegramId: session.telegramId,
        botId: session.botId,
        activeLinkId: session.activeLinkId,
        language: session.language,
        flowState: this.flowJson(session.flow) ?? undefined,
      },
      update: {
        activeLinkId: session.activeLinkId,
        language: session.language,
        // `null` ustunni tozalash uchun ataylab: oqim tugaganda holat qolmasligi kerak
        flowState: this.flowJson(session.flow) ?? { set: null },
      },
    });

    await this.writeCache(session);
  }

  async setFlow(session: BotSession, flow: FlowState | null): Promise<void> {
    session.flow = flow;
    await this.save(session);
  }

  async setLanguage(session: BotSession, language: Language): Promise<void> {
    session.language = language;
    await this.save(session);
  }

  async setActiveLink(
    session: BotSession,
    activeLinkId: string | null,
  ): Promise<void> {
    session.activeLinkId = activeLinkId;
    await this.save(session);
  }

  /**
   * Sessiyani butunlay o'chiradi (kesh + DB). Foydalanuvchi bot bilan aloqasini
   * uzganda va testlarda ishlatiladi — Redis dagi eski `activeLinkId` truncate
   * qilingan bazadan keyin ham qolib ketmasligi kerak.
   */
  async forget(botId: string, telegramId: bigint): Promise<void> {
    // Kesh birinchi o'chiriladi: o'qishda kesh ustun turadi, ya'ni teskari tartibda
    // DB tozalangan bo'lsa ham eski holat qaytib kelishi mumkin edi
    if (this.redisAvailable) {
      await this.redis.del(this.key(botId, telegramId)).catch(() => undefined);
    }

    await this.prisma.db.telegramSession.deleteMany({
      where: { telegramId, botId },
    });
  }

  /**
   * Prisma `Json` ustuni indeks imzosi bo'lgan tipni talab qiladi, union esa uni
   * bermaydi — konvertatsiya bitta joyda, aniq izoh bilan qilinadi.
   */
  private flowJson(flow: FlowState | null): Prisma.InputJsonValue | null {
    return flow === null ? null : (flow as unknown as Prisma.InputJsonValue);
  }

  private async readCache(
    botId: string,
    telegramId: bigint,
  ): Promise<BotSession | null> {
    if (!this.redisAvailable) return null;

    try {
      const raw = await this.redis.get(this.key(botId, telegramId));
      if (!raw) return null;

      const parsed = JSON.parse(raw) as {
        activeLinkId: string | null;
        language: Language;
        flow: FlowState | null;
      };

      return { botId, telegramId, ...parsed };
    } catch {
      return null;
    }
  }

  private async writeCache(session: BotSession): Promise<void> {
    if (!this.redisAvailable) return;

    try {
      await this.redis.set(
        this.key(session.botId, session.telegramId),
        JSON.stringify({
          activeLinkId: session.activeLinkId,
          language: session.language,
          flow: session.flow,
        }),
        'EX',
        this.ttlSeconds,
      );
    } catch {
      // Kesh yozilmasa ham holat DB da bor — oqim buzilmaydi
    }
  }
}
