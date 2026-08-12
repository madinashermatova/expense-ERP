import { Injectable } from '@nestjs/common';
import { langOf, roleName, t } from './bot-texts';
import { ActiveAccount, BotTransport, BotUpdate } from './bot-types';
import { BotSession } from './bot-session.service';
import { guestMenu, LANGUAGE_KEYBOARD, mainMenu } from './keyboards';
import { TelegramAuthService } from './telegram-auth.service';

/**
 * Menyu va kirish ekranlarini chiqarish.
 *
 * Ajratilgan sabab: bir xil menyu login oqimidan, hisob almashtirishdan va oddiy
 * `/menu` dan chiqadi — tugmalar to'plami (ayniqsa "Hisobni almashtirish" ning
 * ko'rinishi) bitta joyda hisoblanishi kerak.
 */
@Injectable()
export class MenuPresenter {
  constructor(private readonly auth: TelegramAuthService) {}

  async showMain(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    account: ActiveAccount,
    text?: string,
  ): Promise<void> {
    const lang = langOf(session.language);
    const accounts = await this.auth.listAccounts(
      update.botId,
      update.telegramId,
    );

    await tx.sendMessage(update.chatId, text ?? t('menuHeader', lang), {
      keyboard: mainMenu(account.role, lang, accounts.length),
    });
  }

  async showGuest(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    text?: string,
  ): Promise<void> {
    const lang = langOf(session.language);
    await tx.sendMessage(update.chatId, text ?? t('guestWelcome', lang), {
      keyboard: guestMenu(lang),
    });
  }

  async showLanguageChoice(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
  ): Promise<void> {
    const lang = langOf(session.language);
    await tx.sendMessage(update.chatId, t('chooseLanguage', lang), {
      inline: LANGUAGE_KEYBOARD,
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
    const lang = langOf(session.language);
    return t('loginSuccess', lang, {
      fullName: account.fullName,
      company: account.companyName,
      role: roleName(account.role, lang),
    });
  }
}
