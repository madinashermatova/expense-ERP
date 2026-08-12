import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegram } from 'telegraf';
import { EnvironmentVariables } from '../../config/env.validation';

export interface SendResult {
  /** Xabar yuborildi */
  sent: boolean;
  /** Foydalanuvchi botni bloklagan — qayta urinish befoyda (TZ 3.11) */
  botBlocked?: boolean;
  /** Bot o'chirilgan yoki token yo'q — yuborish o'tkazib yuborildi */
  skipped?: boolean;
}

/**
 * Telegram yuborish adapteri (TZ 3.11).
 *
 * Bot sahnalari va login oqimi S16 da; bu yerda faqat **chiqish** kanali: bildirishnoma
 * matnini Telegram ga uzatish. Shu sababli Telegraf ning to'liq `Bot` obyekti emas,
 * yengil `Telegram` API mijozi ishlatiladi — webhook yoki polling ko'tarilmaydi.
 */
@Injectable()
export class TelegramSenderService {
  private readonly logger = new Logger(TelegramSenderService.name);
  private client: Telegram | null = null;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get enabled(): boolean {
    return (
      this.config.get('BOT_ENABLED', { infer: true }) === true &&
      Boolean(this.config.get('TELEGRAM_BOT_TOKEN', { infer: true }))
    );
  }

  async send(telegramId: bigint, text: string): Promise<SendResult> {
    if (!this.enabled) return { sent: false, skipped: true };

    try {
      await this.telegram().sendMessage(Number(telegramId), text);
      return { sent: true };
    } catch (error) {
      if (this.isBlocked(error)) {
        this.logger.warn(`Bot bloklangan: telegramId=${String(telegramId)}`);
        return { sent: false, botBlocked: true };
      }
      // Qolgan xatolar yuqoriga chiqadi — job retry ga tushadi (TZ 3.11)
      throw error;
    }
  }

  private telegram(): Telegram {
    if (!this.client) {
      const token = this.config.get('TELEGRAM_BOT_TOKEN', { infer: true });
      this.client = new Telegram(token as string);
    }
    return this.client;
  }

  /**
   * Telegram bloklanganda 403 qaytaradi. Kod bilan birga matn ham tekshiriladi:
   * 403 "chat not found" yoki "user is deactivated" holatlarida ham qayta urinish
   * befoyda, ya'ni ularni ham bloklangan deb hisoblash to'g'ri.
   */
  private isBlocked(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;

    const candidate = error as { code?: number; description?: string };
    if (candidate.code !== 403) return false;

    const description = (candidate.description ?? '').toLowerCase();
    return (
      description.includes('blocked') ||
      description.includes('deactivated') ||
      description.includes('chat not found') ||
      description.length === 0
    );
  }
}
