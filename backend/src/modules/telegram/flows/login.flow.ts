import { Injectable, Logger } from '@nestjs/common';
import { langOf, t } from '../bot-texts';
import { BotSession, BotSessionService } from '../bot-session.service';
import { BotTransport, BotUpdate } from '../bot-types';
import { LoginFlow } from '../flow-state';
import { MenuPresenter } from '../menu.presenter';
import { LoginOutcome, TelegramAuthService } from '../telegram-auth.service';

/** Kompaniya tanlash muddati — parol tekshirilgandan keyin qancha vaqt amal qiladi */
const CHOICE_TTL_MS = 2 * 60 * 1000;

/**
 * Login sahnasi (TZ 3.12.1).
 *
 * Eng muhim talab: **parol yozilgan xabar darhol o'chiriladi** va hech qayerda —
 * na logda, na sessiyada — saqlanmaydi. Shuning uchun parol o'qilgan zahoti
 * `deleteMessage` chaqiriladi, undan keyingina tekshiruv boshlanadi.
 */
@Injectable()
export class LoginFlowHandler {
  private readonly logger = new Logger(LoginFlowHandler.name);

  constructor(
    private readonly auth: TelegramAuthService,
    private readonly sessions: BotSessionService,
    private readonly menu: MenuPresenter,
  ) {}

  async start(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    options: { addAccount?: boolean } = {},
  ): Promise<void> {
    const lang = langOf(session.language);
    await this.sessions.setFlow(session, {
      name: 'login',
      step: 'login',
      addAccount: options.addAccount,
    });
    await tx.sendMessage(update.chatId, t('askLogin', lang));
  }

  async handle(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    flow: LoginFlow,
    restrictCompanyId: string | null,
  ): Promise<void> {
    const lang = langOf(session.language);

    if (flow.step === 'company') {
      await this.handleCompanyChoice(tx, update, session, flow);
      return;
    }

    const text = update.text?.trim();

    if (flow.step === 'login') {
      if (!text) {
        await tx.sendMessage(update.chatId, t('askLogin', lang));
        return;
      }
      await this.sessions.setFlow(session, {
        ...flow,
        step: 'password',
        login: text,
      });
      await tx.sendMessage(update.chatId, t('askPassword', lang));
      return;
    }

    // step === 'password'
    if (update.messageId !== undefined) {
      await this.deletePasswordMessage(tx, update.chatId, update.messageId);
    }

    if (!text || !flow.login) {
      await tx.sendMessage(update.chatId, t('askPassword', lang));
      return;
    }

    const outcome = await this.auth.login({
      botId: update.botId,
      telegramId: update.telegramId,
      login: flow.login,
      password: text,
      restrictCompanyId,
    });

    if (outcome.kind === 'chooseCompany') {
      await this.sessions.setFlow(session, {
        name: 'login',
        step: 'company',
        addAccount: flow.addAccount,
        verifiedAt: new Date().toISOString(),
        companyOptions: outcome.options.map((option) => ({
          userId: option.userId,
          companyName: option.companyName,
        })),
      });
      await tx.sendMessage(update.chatId, t('chooseCompany', lang), {
        inline: outcome.options.map((option) => [
          { text: option.companyName, data: `login:company:${option.userId}` },
        ]),
      });
      return;
    }

    await this.finish(tx, update, session, outcome, flow);
  }

  /** Inline tugma: `login:company:<userId>` */
  async handleCompanyCallback(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    userId: string,
    restrictCompanyId: string | null,
  ): Promise<void> {
    const lang = langOf(session.language);
    const flow = session.flow;

    if (
      !flow ||
      flow.name !== 'login' ||
      flow.step !== 'company' ||
      !flow.companyOptions?.some((option) => option.userId === userId) ||
      !this.choiceIsFresh(flow)
    ) {
      await this.sessions.setFlow(session, null);
      await this.menu.showGuest(tx, update, session, t('choiceExpired', lang));
      return;
    }

    const outcome = await this.auth.completeChosenCompany({
      botId: update.botId,
      telegramId: update.telegramId,
      userId,
      restrictCompanyId,
    });

    await this.finish(tx, update, session, outcome, flow);
  }

  private async handleCompanyChoice(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    flow: LoginFlow,
  ): Promise<void> {
    const lang = langOf(session.language);

    // Bu qadamda faqat inline tugma kutiladi; matn yuborilsa eslatib qo'yiladi
    if (!this.choiceIsFresh(flow)) {
      await this.sessions.setFlow(session, null);
      await this.menu.showGuest(tx, update, session, t('choiceExpired', lang));
      return;
    }

    await tx.sendMessage(update.chatId, t('chooseCompany', lang), {
      inline: (flow.companyOptions ?? []).map((option) => [
        { text: option.companyName, data: `login:company:${option.userId}` },
      ]),
    });
  }

  private choiceIsFresh(flow: LoginFlow): boolean {
    if (!flow.verifiedAt) return false;
    return Date.now() - new Date(flow.verifiedAt).getTime() < CHOICE_TTL_MS;
  }

  private async finish(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    outcome: LoginOutcome,
    flow: LoginFlow,
  ): Promise<void> {
    const lang = langOf(session.language);

    switch (outcome.kind) {
      case 'ok':
      case 'alreadyLinked': {
        await this.sessions.setFlow(session, null);
        await this.sessions.setActiveLink(session, outcome.account.linkId);

        const prefix =
          outcome.kind === 'alreadyLinked'
            ? `${t('alreadyLinked', lang)}\n\n`
            : '';
        await this.menu.showMain(
          tx,
          update,
          session,
          outcome.account,
          prefix + this.menu.greeting(outcome.account, session),
        );
        return;
      }

      case 'locked': {
        await this.sessions.setFlow(session, null);
        await this.menu.showGuest(
          tx,
          update,
          session,
          t('loginLocked', lang, { minutes: outcome.minutes }),
        );
        return;
      }

      case 'inactive':
      case 'suspended': {
        await this.sessions.setFlow(session, null);
        await this.menu.showGuest(
          tx,
          update,
          session,
          t(
            outcome.kind === 'inactive'
              ? 'accountInactive'
              : 'companySuspended',
            lang,
          ),
        );
        return;
      }

      case 'foreignCompany': {
        await this.sessions.setFlow(session, null);
        await this.menu.showGuest(
          tx,
          update,
          session,
          t('foreignCompany', lang, { company: outcome.companyName }),
        );
        return;
      }

      default: {
        // Noto'g'ri login/parol — qaysi biri xato ekani aytilmaydi (TZ 3.12.1)
        await this.sessions.setFlow(session, {
          name: 'login',
          step: 'login',
          addAccount: flow.addAccount,
        });
        await tx.sendMessage(
          update.chatId,
          `${t('invalidCredentials', lang)}\n${t('loginPasswordHint', lang)}\n\n${t('askLogin', lang)}`,
        );
      }
    }
  }

  private async deletePasswordMessage(
    tx: BotTransport,
    chatId: number,
    messageId: number,
  ): Promise<void> {
    try {
      await tx.deleteMessage(chatId, messageId);
    } catch (error) {
      // O'chirish imkonsiz bo'lsa ham oqim davom etadi, lekin bu diqqatga sazovor
      this.logger.warn(
        `Parol xabari o'chirilmadi: chat=${chatId} msg=${messageId}`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }
}
