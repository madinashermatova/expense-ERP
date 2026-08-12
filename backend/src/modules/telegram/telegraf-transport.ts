import { Telegram } from 'telegraf';
import { BotTransport, ReplyOptions } from './bot-types';

/**
 * `BotTransport` ning Telegraf ustidagi amalga oshirilishi.
 *
 * Klaviatura shakli faqat shu yerda Telegram formatiga o'tadi — sahnalar tugmalarni
 * oddiy massiv sifatida beradi, ya'ni testlarda ularni Telegraf tiplaridan mustaqil
 * tekshirish mumkin.
 */
export class TelegrafTransport implements BotTransport {
  constructor(private readonly telegram: Telegram) {}

  async sendMessage(
    chatId: number,
    text: string,
    options: ReplyOptions = {},
  ): Promise<void> {
    await this.telegram.sendMessage(chatId, text, {
      reply_markup: this.markup(options),
    });
  }

  async deleteMessage(chatId: number, messageId: number): Promise<void> {
    await this.telegram.deleteMessage(chatId, messageId);
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await this.telegram.answerCbQuery(callbackId, text);
  }

  private markup(options: ReplyOptions) {
    if (options.inline) {
      return {
        inline_keyboard: options.inline.map((row) =>
          row.map((button) => ({
            text: button.text,
            callback_data: button.data,
          })),
        ),
      };
    }

    if (options.keyboard) {
      return {
        keyboard: options.keyboard.map((row) =>
          row.map((label) => ({ text: label })),
        ),
        resize_keyboard: true,
      };
    }

    return undefined;
  }
}
