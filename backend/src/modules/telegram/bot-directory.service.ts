import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EnvironmentVariables } from '../../config/env.validation';

export interface BotEntry {
  /** Telegram bot ning raqamli id si — token ning `:` dan oldingi qismi */
  botId: string;
  token: string;
  /** `null` — umumiy platforma boti; qiymat bo'lsa faqat shu kompaniyaga xizmat qiladi */
  companyId: string | null;
  companyName: string | null;
}

/**
 * Bot ro'yxati: **token → companyId** xaritasi (TZ 3.16.5).
 *
 * Ikkala rejim yonma-yon ishlaydi: umumiy bot (env dagi token, tenant login orqali
 * aniqlanadi) va kompaniyaning o'z boti (`Company.telegramBotToken`, shifrlangan).
 *
 * `botId` ataylab token dan olinadi, kompaniya id sidan emas: sessiya kaliti
 * (`bot:{botId}:{telegramId}`) va `TelegramAccountLink.botId` aynan Telegram dagi
 * bot bilan bog'lanishi kerak — kompaniya keyinchalik tokenni almashtirsa, eski
 * bot orqali qolgan bog'lanishlar avtomatik boshqa kalitga tushadi.
 */
@Injectable()
export class BotDirectoryService {
  private readonly logger = new Logger(BotDirectoryService.name);
  private entries = new Map<string, BotEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** Umumiy bot id si — token bo'lmasa `shared` (bot o'chirilgan holat) */
  get sharedBotId(): string | null {
    const token = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    return token ? botIdFromToken(token) : null;
  }

  async load(): Promise<BotEntry[]> {
    const entries = new Map<string, BotEntry>();

    const sharedToken = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
    if (sharedToken) {
      entries.set(botIdFromToken(sharedToken), {
        botId: botIdFromToken(sharedToken),
        token: sharedToken,
        companyId: null,
        companyName: null,
      });
    }

    // `Company` tenant allow-list ida — platforma darajasidagi o'qish
    const companies = await this.prisma.db.company.findMany({
      where: { telegramBotToken: { not: null } },
      select: { id: true, name: true, telegramBotToken: true },
    });

    for (const company of companies) {
      const token = this.decrypt(company.telegramBotToken!, company.id);
      if (!token) continue;

      const botId = botIdFromToken(token);
      // Kompaniya boti umumiy bot bilan bir xil token bo'lsa — sozlash xatosi
      if (entries.has(botId) && entries.get(botId)!.companyId === null) {
        this.logger.warn(
          `Kompaniya ${company.id} tokeni umumiy bot tokeni bilan bir xil — o'tkazib yuborildi`,
        );
        continue;
      }

      entries.set(botId, {
        botId,
        token,
        companyId: company.id,
        companyName: company.name,
      });
    }

    this.entries = entries;
    return [...entries.values()];
  }

  all(): BotEntry[] {
    return [...this.entries.values()];
  }

  entry(botId: string): BotEntry | null {
    return this.entries.get(botId) ?? null;
  }

  /** Kompaniya boti bo'lsa uning `companyId` si; umumiy botda `null` */
  restrictCompanyId(botId: string): string | null {
    return this.entries.get(botId)?.companyId ?? null;
  }

  private decrypt(stored: string, companyId: string): string | null {
    if (!this.encryption.isEncrypted(stored)) {
      // Shifrlanmagan token — sozlamalar orqali kelmagan, ishlatilmaydi
      this.logger.warn(
        `Kompaniya ${companyId} bot tokeni shifrlanmagan — o'tkazib yuborildi`,
      );
      return null;
    }

    try {
      return this.encryption.decrypt(stored);
    } catch {
      this.logger.error(`Kompaniya ${companyId} bot tokeni ochilmadi`);
      return null;
    }
  }
}

export function botIdFromToken(token: string): string {
  const [id] = token.split(':');
  return id || token;
}
