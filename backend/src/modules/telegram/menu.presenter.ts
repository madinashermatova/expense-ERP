import { Injectable } from '@nestjs/common';
import { ActiveAccount, BotTransport, BotUpdate } from './bot-types';
import { BotSession } from './bot-session.service';
import { TelegramAuthService } from './telegram-auth.service';
import { toAppLanguage } from '../../common/i18n/languages';
import { BotTextService } from './bot-text.service';

/**
 * Menyu va kirish ekranlarini chiqarish.
 *
 * Ajratilgan sabab: bir xil menyu login oqimidan, hisob almashtirishdan va oddiy
 * `/menu` dan chiqadi — tugmalar to'plami (ayniqsa "Hisobni almashtirish" ning
 * ko'rinishi) bitta joyda hisoblanishi kerak.
 */
@Injectable()
export class MenuPresenter {
  constructor(
    private readonly auth: TelegramAuthService,
    private readonly texts: BotTextService,
  ) {}

  async showMain(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    account: ActiveAccount,
    text?: string,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const accounts = await this.auth.listAccounts(
      update.botId,
      update.telegramId,
    );

    await tx.sendMessage(
      update.chatId,
      text ?? this.texts.t('menuHeader', lang),
      {
        keyboard: this.texts.mainMenu(account.role, lang, accounts.length),
      },
    );
  }

  async showGuest(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    text?: string,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    await tx.sendMessage(
      update.chatId,
      text ?? this.texts.t('guestWelcome', lang),
      {
        keyboard: this.texts.guestMenu(lang),
      },
    );
  }

  async showLanguageChoice(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    await tx.sendMessage(update.chatId, this.texts.t('chooseLanguage', lang), {
      inline: this.texts.languageKeyboard(),
    });
  }

  /** Bog'langan hisoblar soni — kartochkalarda kompaniya ko'rsatish uchun */
  async linkedAccountCount(update: BotUpdate): Promise<number> {
    const accounts = await this.auth.listAccounts(
      update.botId,
      update.telegramId,
    );
    return accounts.length;
  }

  greeting(account: ActiveAccount, session: BotSession): string {
    const lang = toAppLanguage(session.language);
    return this.texts.t('loginSuccess', lang, {
      fullName: account.fullName,
      company: account.companyName,
      role: this.texts.roleName(account.role, lang),
    });
  }
}
