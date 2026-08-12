import { Injectable } from '@nestjs/common';
import { BotSession, BotSessionService } from '../bot-session.service';
import { BotTransport, BotUpdate, InlineButton } from '../bot-types';
import { MenuPresenter } from '../menu.presenter';
import { TelegramAuthService } from '../telegram-auth.service';
import { LoginFlowHandler } from './login.flow';
import { toAppLanguage } from '../../../common/i18n/languages';
import { BotTextService } from '../bot-text.service';

/**
 * Hisobni almashtirish, qo'shish va chiqish (TZ 3.12.2).
 *
 * Parol qayta so'ralmaydi: `TelegramAccountLink` ning o'zi tasdiqlangan bog'lanish —
 * almashtirish faqat `activeLinkId` ni ko'chiradi. Almashtirishda **yarim tugallangan
 * oqim bekor qilinadi**: aks holda xarajat kiritish o'rtasida kontekst almashib,
 * yozuv boshqa kompaniyaga tushib ketishi mumkin edi.
 */
@Injectable()
export class AccountsFlowHandler {
  constructor(
    private readonly auth: TelegramAuthService,
    private readonly sessions: BotSessionService,
    private readonly menu: MenuPresenter,
    private readonly login: LoginFlowHandler,
    private readonly texts: BotTextService,
  ) {}

  async showList(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const accounts = await this.auth.listAccounts(
      update.botId,
      update.telegramId,
    );

    const rows: InlineButton[][] = accounts.map((account) => [
      {
        text: `${account.linkId === session.activeLinkId ? '✅ ' : ''}${account.companyName} — ${account.fullName} (${this.texts.roleName(account.role, lang)})`,
        data: `acc:switch:${account.linkId}`,
      },
    ]);

    rows.push([{ text: this.texts.addAccountLabel(lang), data: 'acc:add' }]);
    rows.push([{ text: this.texts.logoutLabel(lang), data: 'acc:logout' }]);
    if (accounts.length > 1) {
      rows.push([
        { text: this.texts.logoutAllLabel(lang), data: 'acc:logoutAll' },
      ]);
    }

    await tx.sendMessage(update.chatId, this.texts.t('accountsHeader', lang), {
      inline: rows,
    });
  }

  async switchTo(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    linkId: string,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const account = await this.auth.switchTo(
      update.botId,
      update.telegramId,
      linkId,
    );

    if (!account) {
      await this.menu.showGuest(
        tx,
        update,
        session,
        this.texts.t('sessionExpired', lang),
      );
      await this.sessions.setActiveLink(session, null);
      return;
    }

    const hadFlow = session.flow !== null;
    session.flow = null;
    await this.sessions.setActiveLink(session, linkId);

    const header = [
      hadFlow ? this.texts.t('flowCancelledBySwitch', lang) : null,
      this.texts.t('accountSwitched', lang, {
        company: account.companyName,
        fullName: account.fullName,
        role: this.texts.roleName(account.role, lang),
      }),
    ]
      .filter(Boolean)
      .join('\n\n');

    await this.menu.showMain(tx, update, session, account, header);
  }

  async addAccount(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
  ): Promise<void> {
    await this.login.start(tx, update, session, { addAccount: true });
  }

  async logoutActive(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    if (!session.activeLinkId) {
      await this.menu.showGuest(
        tx,
        update,
        session,
        this.texts.t('notLoggedIn', lang),
      );
      return;
    }

    const next = await this.auth.logoutActive(
      update.botId,
      update.telegramId,
      session.activeLinkId,
    );

    session.flow = null;

    // Boshqa bog'langan hisob bo'lsa unga o'tiladi, aks holda kirish ekrani (TZ 3.12.2)
    if (!next) {
      await this.sessions.setActiveLink(session, null);
      await this.menu.showGuest(
        tx,
        update,
        session,
        this.texts.t('loggedOut', lang),
      );
      return;
    }

    const account = await this.auth.switchTo(
      update.botId,
      update.telegramId,
      next.linkId,
    );
    if (!account) {
      await this.sessions.setActiveLink(session, null);
      await this.menu.showGuest(
        tx,
        update,
        session,
        this.texts.t('loggedOut', lang),
      );
      return;
    }

    await this.sessions.setActiveLink(session, account.linkId);
    await this.menu.showMain(
      tx,
      update,
      session,
      account,
      `${this.texts.t('loggedOut', lang)}\n\n${this.texts.t(
        'accountSwitched',
        lang,
        {
          company: account.companyName,
          fullName: account.fullName,
          role: this.texts.roleName(account.role, lang),
        },
      )}`,
    );
  }

  async logoutAll(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    await this.auth.logoutAll(update.botId, update.telegramId);
    session.flow = null;
    await this.sessions.setActiveLink(session, null);
    await this.menu.showGuest(
      tx,
      update,
      session,
      this.texts.t('loggedOutAll', lang),
    );
  }
}
