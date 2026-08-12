import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf } from 'telegraf';
import { Message, Update } from 'telegraf/types';
import { EnvironmentVariables } from '../../config/env.validation';
import { BotDirectoryService, BotEntry } from './bot-directory.service';
import { BotRouterService } from './bot-router.service';
import { BotUpdate } from './bot-types';
import { TelegrafTransport } from './telegraf-transport';

/**
 * Telegraf instansiyalarini ko'tarish (TZ 3.16.5).
 *
 * Bitta jarayonda bir nechta bot: umumiy platforma boti va kompaniyalarning o'z botlari.
 * Har bir yangilanish transportdan mustaqil `BotUpdate` ga aylantirilib routerga uzatiladi —
 * shu chiziq bot mantig'ini Telegram API sidan ajratib turadi.
 */
@Injectable()
export class BotLauncherService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BotLauncherService.name);
  private readonly bots = new Map<string, Telegraf>();

  constructor(
    private readonly directory: BotDirectoryService,
    private readonly router: BotRouterService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get('BOT_ENABLED', { infer: true })) {
      this.logger.log("Bot o'chirilgan (BOT_ENABLED=false)");
      return;
    }

    // Testlarda polling ko'tarilmaydi: router to'g'ridan-to'g'ri chaqirib sinaladi
    if (process.env.DISABLE_BOT_POLLING === 'true') {
      await this.directory.load();
      this.logger.log("Bot polling o'chirilgan (DISABLE_BOT_POLLING=true)");
      return;
    }

    const entries = await this.directory.load();
    for (const entry of entries) {
      this.start(entry);
    }

    this.logger.log(`Telegram botlar ishga tushdi: ${entries.length}`);
  }

  onApplicationShutdown(): void {
    for (const [botId, bot] of this.bots) {
      try {
        bot.stop('SIGTERM');
      } catch (error) {
        this.logger.warn(
          `Bot to'xtatilmadi: ${botId} — ${error instanceof Error ? error.message : ''}`,
        );
      }
    }
    this.bots.clear();
  }

  private start(entry: BotEntry): void {
    const bot = new Telegraf(entry.token);

    bot.on('message', (ctx) => this.forward(entry, ctx));
    bot.on('callback_query', (ctx) => this.forward(entry, ctx));

    bot.catch((error) => {
      this.logger.error(
        `Telegraf xatosi: bot=${entry.botId}`,
        error instanceof Error ? error.stack : undefined,
      );
    });

    /*
     * `launch()` polling tugaguncha (ya'ni bot to'xtaguncha) hal bo'lmaydi — shuning
     * uchun `await` qilinmaydi, aks holda ilova ishga tushishi shu yerda muzlab qolardi.
     */
    void bot.launch().catch((error: unknown) => {
      this.logger.error(
        `Bot ishga tushmadi: ${entry.botId}`,
        error instanceof Error ? error.stack : undefined,
      );
    });

    this.bots.set(entry.botId, bot);
  }

  private async forward(entry: BotEntry, ctx: Context): Promise<void> {
    const update = this.toBotUpdate(entry, ctx);
    if (!update) return;

    await this.router.handle(update, new TelegrafTransport(ctx.telegram));
  }

  private toBotUpdate(entry: BotEntry, ctx: Context): BotUpdate | null {
    const from = ctx.from;
    const chatId = ctx.chat?.id;
    if (!from || chatId === undefined) return null;

    const base = {
      botId: entry.botId,
      telegramId: BigInt(from.id),
      chatId,
    };

    if ('callback_query' in ctx.update) {
      const query = ctx.update.callback_query;
      return {
        ...base,
        callbackId: query.id,
        callbackData: 'data' in query ? query.data : undefined,
      };
    }

    const message = (ctx.update as Update.MessageUpdate).message as Message;

    const photo =
      'photo' in message && message.photo?.length
        ? // Telegram bir rasmni bir nechta o'lchamda beradi — oxirgisi eng kattasi
          message.photo[message.photo.length - 1]
        : null;
    const document = 'document' in message ? message.document : undefined;

    return {
      ...base,
      messageId: message.message_id,
      text: 'text' in message ? message.text : undefined,
      photoFileId: photo?.file_id,
      documentFileId: document?.file_id,
      documentName: document?.file_name,
      documentMimeType: document?.mime_type,
      fileSize: photo?.file_size ?? document?.file_size,
    };
  }
}
