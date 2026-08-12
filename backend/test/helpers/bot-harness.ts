import { INestApplication } from '@nestjs/common';
import { BotRouterService } from '../../src/modules/telegram/bot-router.service';
import {
  BUTTON_IDS,
  BotTextService,
  ButtonId,
} from '../../src/modules/telegram/bot-text.service';
import {
  BotTransport,
  ReplyOptions,
} from '../../src/modules/telegram/bot-types';

export interface SentMessage {
  chatId: number;
  text: string;
  options: ReplyOptions;
}

/**
 * Bot testlari uchun transport (TZ 3.12).
 *
 * Tarmoq umuman ishlatilmaydi: router `BotTransport` interfeysi bilan gaplashadi, bu
 * yerda esa yozilgan xabarlar yig'iladi. Shu sababli "parol xabari o'chirildimi",
 * "qanday klaviatura chiqdi" kabi talablarni to'g'ridan-to'g'ri tekshirish mumkin.
 */
export class FakeTransport implements BotTransport {
  readonly sent: SentMessage[] = [];
  readonly deleted: { chatId: number; messageId: number }[] = [];
  readonly answered: string[] = [];
  readonly downloaded: string[] = [];

  sendMessage(
    chatId: number,
    text: string,
    options: ReplyOptions = {},
  ): Promise<void> {
    this.sent.push({ chatId, text, options });
    return Promise.resolve();
  }

  deleteMessage(chatId: number, messageId: number): Promise<void> {
    this.deleted.push({ chatId, messageId });
    return Promise.resolve();
  }

  answerCallback(callbackId: string): Promise<void> {
    this.answered.push(callbackId);
    return Promise.resolve();
  }

  /** Haqiqiy PNG (1x1) — fayl turi mazmun bo'yicha aniqlanadi */
  downloadFile(fileId: string): Promise<Buffer> {
    this.downloaded.push(fileId);
    return Promise.resolve(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
  }

  reset(): void {
    this.sent.length = 0;
    this.deleted.length = 0;
    this.answered.length = 0;
    this.downloaded.length = 0;
  }

  get last(): SentMessage {
    if (this.sent.length === 0) throw new Error('Bot hech narsa yubormadi');
    return this.sent[this.sent.length - 1];
  }

  /** Barcha yuborilgan matnlar — birlashtirilgan holda (qidirish uchun) */
  get allText(): string {
    return this.sent.map((message) => message.text).join('\n---\n');
  }

  /** Oxirgi xabardagi inline tugmalar (tekis ro'yxat) */
  get lastInline(): { text: string; data: string }[] {
    return (this.last.options.inline ?? []).flat();
  }

  /** Oxirgi xabardagi pastdagi klaviatura tugmalari (tekis ro'yxat) */
  get lastKeyboard(): string[] {
    return (this.last.options.keyboard ?? []).flat();
  }
}

/** Bitta Telegram foydalanuvchisi nomidan bot bilan muloqot qiladi */
export class BotUser {
  private messageId = 100;

  constructor(
    private readonly router: BotRouterService,
    readonly tx: FakeTransport,
    readonly botId: string,
    readonly telegramId: bigint,
  ) {}

  async send(text: string): Promise<void> {
    this.messageId += 1;
    await this.router.handle(
      {
        botId: this.botId,
        telegramId: this.telegramId,
        chatId: Number(this.telegramId),
        messageId: this.messageId,
        text,
      },
      this.tx,
    );
  }

  /** Rasm yuboradi (chek/isbot qadamlari uchun) */
  async sendPhoto(fileId: string): Promise<void> {
    this.messageId += 1;
    await this.router.handle(
      {
        botId: this.botId,
        telegramId: this.telegramId,
        chatId: Number(this.telegramId),
        messageId: this.messageId,
        photoFileId: fileId,
      },
      this.tx,
    );
  }

  /** Oxirgi yuborilgan xabar id si — parol o'chirilishini tekshirish uchun */
  get lastMessageId(): number {
    return this.messageId;
  }

  async press(callbackData: string): Promise<void> {
    await this.router.handle(
      {
        botId: this.botId,
        telegramId: this.telegramId,
        chatId: Number(this.telegramId),
        callbackId: `cb-${this.messageId}`,
        callbackData,
      },
      this.tx,
    );
  }

  /** Inline tugma ma'lumotini matni bo'yicha topadi */
  inlineData(needle: string): string {
    const button = this.tx.lastInline.find((candidate) =>
      candidate.text.includes(needle),
    );
    if (!button) {
      throw new Error(
        `"${needle}" tugmasi topilmadi: ${JSON.stringify(this.tx.lastInline)}`,
      );
    }
    return button.data;
  }

  /** Inline tugmani matni bo'yicha bosadi */
  async pressByText(needle: string): Promise<void> {
    await this.press(this.inlineData(needle));
  }
}

/**
 * Tugma yorliqlari ikki tilda: testlar tugmani **matn bilan** bosadi (foydalanuvchi
 * ham shunday qiladi), matnlar esa i18n fayllarida — shu sababli ular ilovadan olinadi.
 */
export type ButtonLabels = Record<ButtonId, { uz: string; ru: string }>;

export function buttonLabels(app: INestApplication): ButtonLabels {
  const texts = app.get(BotTextService);
  const out = {} as ButtonLabels;

  for (const id of BUTTON_IDS) {
    out[id] = { uz: texts.button(id, 'uz'), ru: texts.button(id, 'ru') };
  }

  return out;
}

export function botUser(
  app: INestApplication,
  telegramId: bigint,
  botId = 'test-bot',
): BotUser {
  return new BotUser(
    app.get(BotRouterService),
    new FakeTransport(),
    botId,
    telegramId,
  );
}
