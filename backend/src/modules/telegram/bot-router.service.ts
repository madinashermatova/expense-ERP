import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { EnvironmentVariables } from '../../config/env.validation';
import { Channel, Role } from '../../generated/prisma/enums';
import { BotDirectoryService } from './bot-directory.service';
import { BotSession, BotSessionService } from './bot-session.service';
import { ActiveAccount, BotTransport, BotUpdate } from './bot-types';
import { AccountsFlowHandler } from './flows/accounts.flow';
import { ApprovalsFlowHandler } from './flows/approvals.flow';
import { RequestsFlowHandler } from './flows/requests.flow';
import { ExpenseFlowHandler } from './flows/expense.flow';
import { ListsFlowHandler } from './flows/lists.flow';
import { LoginFlowHandler } from './flows/login.flow';
import { isFlow } from './flow-state';
import { MenuPresenter } from './menu.presenter';
import { TelegramAuthService } from './telegram-auth.service';
import {
  AppLanguage,
  fromAppLanguage,
  toAppLanguage,
} from '../../common/i18n/languages';
import { BotTextService, ButtonId } from './bot-text.service';

/**
 * Bot yangilanishlarini yo'naltirish (TZ 3.12).
 *
 * Telegraf ning `Scenes` mexanizmi o'rniga o'z holat mashinasi ishlatiladi: holat
 * baribir Redis da saqlanishi shart (bot restartdan keyin oqim davom etadi), sahna
 * bosqichlari esa bizga `flowState` union i sifatida kerak. Natijada router transportdan
 * mustaqil bo'ladi va testlarda tarmoqqa chiqmasdan tekshiriladi.
 *
 * Har bir amal **faol hisob konteksti ichida** bajariladi: `companyId` sessiyadan emas,
 * `activeLinkId` orqali bazadan olinadi — Redis dagi qiymat eskirgan bo'lsa ham
 * cross-tenant oqish bo'lmaydi.
 */
@Injectable()
export class BotRouterService {
  private readonly logger = new Logger(BotRouterService.name);

  constructor(
    private readonly sessions: BotSessionService,
    private readonly auth: TelegramAuthService,
    private readonly directory: BotDirectoryService,
    private readonly login: LoginFlowHandler,
    private readonly accounts: AccountsFlowHandler,
    private readonly expenseFlow: ExpenseFlowHandler,
    private readonly lists: ListsFlowHandler,
    private readonly approvalsFlow: ApprovalsFlowHandler,
    private readonly requests: RequestsFlowHandler,
    private readonly menu: MenuPresenter,
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly texts: BotTextService,
  ) {}

  async handle(update: BotUpdate, tx: BotTransport): Promise<void> {
    try {
      if (update.callbackId) {
        // Telegram tugma bosilganini 10 s ichida tasdiqlashni talab qiladi
        await tx.answerCallback(update.callbackId);
      }
      await this.dispatch(update, tx);
    } catch (error) {
      this.logger.error(
        `Bot yangilanishi qayta ishlanmadi: bot=${update.botId} tg=${String(update.telegramId)}`,
        error instanceof Error ? error.stack : undefined,
      );
      const session = await this.sessions
        .load(update.botId, update.telegramId)
        .catch(() => null);
      const lang: AppLanguage = session
        ? toAppLanguage(session.language)
        : 'uz';
      await tx
        .sendMessage(update.chatId, this.texts.t('serverError', lang))
        .catch(() => undefined);
    }
  }

  private async dispatch(update: BotUpdate, tx: BotTransport): Promise<void> {
    const session = await this.sessions.load(update.botId, update.telegramId);
    const restrictCompanyId = this.directory.restrictCompanyId(update.botId);

    if (update.callbackData?.startsWith('lang:')) {
      await this.changeLanguage(tx, update, session);
      return;
    }

    const active = await this.auth.resolveActive(
      update.botId,
      update.telegramId,
      session.activeLinkId,
    );

    // Bog'lanish bekor qilingan yoki 30 kun o'tgan — qayta login (TZ 3.12.2)
    if (!active && session.activeLinkId) {
      session.flow = null;
      await this.sessions.setActiveLink(session, null);
      await this.menu.showGuest(
        tx,
        update,
        session,
        this.texts.t('sessionExpired', toAppLanguage(session.language)),
      );
      return;
    }

    if (update.text === '/start') {
      await this.handleStart(tx, update, session, active);
      return;
    }

    if (update.text === '/cancel') {
      await this.handleCancel(tx, update, session, active);
      return;
    }

    if (update.callbackData?.startsWith('login:company:')) {
      await this.login.handleCompanyCallback(
        tx,
        update,
        session,
        update.callbackData.slice('login:company:'.length),
        restrictCompanyId,
      );
      return;
    }

    /*
     * Menyu tugmasi oqimdan ustun turadi: pastdagi klaviatura oqim davomida ham
     * ekranda qoladi va TZ 3.12.2 hisobni **oqim o'rtasida** almashtirishni talab
     * qiladi. Tugma matnlari emoji bilan boshlanadi, ya'ni ular login yoki izoh
     * sifatida kiritilgan matn bilan chalkashmaydi.
     */
    const menuButton = update.text
      ? this.texts.buttonIdFromLabel(update.text)
      : null;

    // Inline tugma (callback) hech qachon oqimning matn qadamiga kirmaydi —
    // u prefiksi bo'yicha yuqorida yo'naltiriladi yoki menyu amali bo'ladi
    if (
      !update.callbackData &&
      menuButton === null &&
      isFlow(session.flow, 'login')
    ) {
      await this.login.handle(
        tx,
        update,
        session,
        session.flow,
        restrictCompanyId,
      );
      return;
    }

    if (!active) {
      await this.handleGuest(tx, update, session);
      return;
    }

    await this.tenantContext.runAsync(
      {
        companyId: active.companyId,
        userId: active.userId,
        role: active.role,
        branchId: active.branchId,
        channel: Channel.TELEGRAM,
      },
      () => this.handleAuthenticated(tx, update, session, active, menuButton),
    );
  }

  private async handleStart(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount | null,
  ): Promise<void> {
    session.flow = null;
    await this.sessions.setFlow(session, null);

    if (active) {
      await this.menu.showMain(tx, update, session, active);
      return;
    }

    // Kirmagan foydalanuvchi: avval til, keyin kirish ekrani (TZ 3.12.1)
    await this.menu.showLanguageChoice(tx, update, session);
    await this.menu.showGuest(tx, update, session);
  }

  private async handleCancel(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount | null,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const had = session.flow !== null;
    await this.sessions.setFlow(session, null);

    const text = this.texts.t(had ? 'cancelled' : 'nothingToCancel', lang);
    if (active) {
      await this.menu.showMain(tx, update, session, active, text);
    } else {
      await this.menu.showGuest(tx, update, session, text);
    }
  }

  private async changeLanguage(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
  ): Promise<void> {
    const value = update.callbackData!.slice('lang:'.length);
    await this.sessions.setLanguage(
      session,
      fromAppLanguage(value === 'ru' ? 'ru' : 'uz'),
    );

    const lang = toAppLanguage(session.language);
    const active = await this.auth.resolveActive(
      update.botId,
      update.telegramId,
      session.activeLinkId,
    );

    if (active) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('languageChanged', lang),
      );
      return;
    }

    await this.menu.showGuest(
      tx,
      update,
      session,
      this.texts.t('languageChanged', lang),
    );
  }

  /** Kirmagan foydalanuvchi faqat kirish va yordamni ko'radi (TZ 3.12.1) */
  private async handleGuest(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const button = update.text
      ? this.texts.buttonIdFromLabel(update.text)
      : null;

    if (button === 'login') {
      await this.login.start(tx, update, session);
      return;
    }

    if (button === 'help' || update.text === '/help') {
      await this.menu.showGuest(
        tx,
        update,
        session,
        this.texts.t('help', lang),
      );
      return;
    }

    await this.menu.showGuest(
      tx,
      update,
      session,
      this.texts.t('notLoggedIn', lang),
    );
  }

  private async handleAuthenticated(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    button: ButtonId | null,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (update.callbackData?.startsWith('acc:')) {
      await this.handleAccountCallback(
        tx,
        update,
        session,
        update.callbackData,
      );
      return;
    }

    /*
     * Oqim davomida menyu tugmasi bosilsa oqim bekor qilinadi va foydalanuvchi
     * bu haqda ogohlantiriladi — yarim to'ldirilgan xarajat jim yo'qolmaydi.
     */
    if (
      button !== null &&
      session.flow !== null &&
      !FLOW_NEUTRAL_BUTTONS.has(button)
    ) {
      await this.sessions.setFlow(session, null);
      await tx.sendMessage(update.chatId, this.texts.t('cancelled', lang));
    }

    // Qaror kartochkalari va so'rov sahnalari — prefiks bo'yicha
    if (
      update.callbackData?.startsWith('apr:') ||
      ((update.callbackData?.startsWith('rfd:') ||
        update.callbackData?.startsWith('edt:')) &&
        this.isDecisionCallback(update.callbackData))
    ) {
      await this.approvalsFlow.handleCallback(
        tx,
        update,
        session,
        active,
        update.callbackData,
      );
      return;
    }

    if (update.callbackData?.startsWith('rfd:')) {
      if (!isFlow(session.flow, 'refund')) {
        await this.menu.showMain(tx, update, session, active);
        return;
      }
      await this.requests.handleRefundCallback(
        tx,
        update,
        session,
        active,
        session.flow,
        update.callbackData,
      );
      return;
    }

    if (update.callbackData?.startsWith('edt:')) {
      if (!isFlow(session.flow, 'editRequest')) {
        await this.menu.showMain(tx, update, session, active);
        return;
      }
      await this.requests.handleEditCallback(
        tx,
        update,
        session,
        active,
        session.flow,
        update.callbackData,
      );
      return;
    }

    if (update.callbackData?.startsWith('exp:')) {
      if (!isFlow(session.flow, 'expense')) {
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('nothingToCancel', lang),
        );
        return;
      }
      await this.expenseFlow.handleCallback(
        tx,
        update,
        session,
        active,
        session.flow,
        update.callbackData,
      );
      return;
    }

    // Matn yoki fayl — ochiq oqim qadamiga tegishli
    if (button === null) {
      if (isFlow(session.flow, 'expense')) {
        await this.expenseFlow.handleText(
          tx,
          update,
          session,
          active,
          session.flow,
        );
        return;
      }

      if (isFlow(session.flow, 'decision')) {
        await this.approvalsFlow.handleReason(
          tx,
          update,
          session,
          active,
          session.flow,
        );
        return;
      }

      if (isFlow(session.flow, 'refund')) {
        await this.requests.handleRefundInput(
          tx,
          update,
          session,
          active,
          session.flow,
        );
        return;
      }

      if (isFlow(session.flow, 'editRequest')) {
        await this.requests.handleEditInput(
          tx,
          update,
          session,
          active,
          session.flow,
        );
        return;
      }
    }

    if (
      button !== null &&
      APPROVER_BUTTONS.has(button) &&
      active.role === Role.WORKER
    ) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('notAvailableYet', lang),
      );
      return;
    }

    switch (button) {
      case 'addExpense':
        await this.expenseFlow.start(tx, update, session, active);
        return;

      case 'myExpenses':
        await this.lists.myExpenses(tx, update, session, active);
        return;

      case 'branchExpenses':
        await this.lists.branchExpenses(tx, update, session, active);
        return;

      /*
       * Tasdiqlovchi ekranlari rolga bog'liq: ishchi menyusida bu tugmalar yo'q,
       * lekin eski klaviatura yoki qo'lda yuborilgan matn orqali kelishi mumkin.
       * `ExpensesService.list` ishchini o'z yozuvlari bilan cheklamaydi, shuning
       * uchun tekshiruv aynan shu yerda.
       */
      case 'pendingApprovals':
        await this.approvalsFlow.showApprovals(
          tx,
          update,
          session,
          active,
          'director',
        );
        return;

      case 'finalApprovals':
        await this.approvalsFlow.showApprovals(
          tx,
          update,
          session,
          active,
          'admin',
        );
        return;

      case 'refundRequests':
        await this.approvalsFlow.showRefundRequests(
          tx,
          update,
          session,
          active,
        );
        return;

      case 'editRequests':
        await this.approvalsFlow.showEditRequests(tx, update, session, active);
        return;

      case 'refund':
        await this.requests.startRefund(tx, update, session, active);
        return;

      case 'editRequest':
        await this.requests.startEditRequest(tx, update, session, active);
        return;

      case 'myStats':
        await this.lists.stats(tx, update, session, active, 'own');
        return;

      case 'branchStats':
      case 'companyStats':
        await this.lists.stats(tx, update, session, active, 'scoped');
        return;

      case 'switchAccount':
        await this.accounts.showList(tx, update, session);
        return;

      case 'logout':
        await this.accounts.logoutActive(tx, update, session);
        return;

      // Kirmagan holatdagi klaviatura ekranda qolib ketgan bo'lishi mumkin —
      // kirgan foydalanuvchi uchun bu "hisob qo'shish" degani (TZ 3.12.2)
      case 'login':
        await this.accounts.addAccount(tx, update, session);
        return;

      case 'settings':
        await this.showSettings(tx, update, session, active);
        return;

      case 'help':
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('help', lang),
        );
        return;

      case 'webErp':
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('webLink', lang, {
            url: this.config.get('WEB_URL', { infer: true }),
          }),
        );
        return;

      case null:
        if (update.text === '/menu' || update.text === '/help') {
          await this.menu.showMain(
            tx,
            update,
            session,
            active,
            update.text === '/help' ? this.texts.t('help', lang) : undefined,
          );
          return;
        }
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('unknownCommand', lang),
        );
        return;

      default:
        // Qolgan bo'limlar keyingi bosqichlarda ulanadi (S16.2, S16.3)
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('notAvailableYet', lang),
        );
    }
  }

  /**
   * `rfd:`/`edt:` prefikslari ikki joyda ishlatiladi: tasdiqlovchi qarorlari
   * (`ok`/`no`/`go`) va ishchining so'rov sahnasi (`exp`/`cancel`/`send`).
   * Ajratish aynan shu ro'yxat bilan — prefiksni ikkiga bo'lish kod o'qishni
   * qiyinlashtirardi.
   */
  private isDecisionCallback(data: string): boolean {
    const action = data.split(':')[1];
    return action === 'ok' || action === 'no' || action === 'go';
  }

  private async handleAccountCallback(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    data: string,
  ): Promise<void> {
    if (data.startsWith('acc:switch:')) {
      await this.accounts.switchTo(
        tx,
        update,
        session,
        data.slice('acc:switch:'.length),
      );
      return;
    }

    switch (data) {
      case 'acc:add':
        await this.accounts.addAccount(tx, update, session);
        return;
      case 'acc:logout':
        await this.accounts.logoutActive(tx, update, session);
        return;
      case 'acc:logoutAll':
        await this.accounts.logoutAll(tx, update, session);
        return;
      default:
        await this.accounts.showList(tx, update, session);
    }
  }

  private async showSettings(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    const profile = this.texts.t('profile', lang, {
      fullName: active.fullName,
      company: active.companyName,
      role: this.texts.roleName(active.role, lang),
      branch: active.branchName ?? '—',
    });

    /*
     * "Hisob qo'shish" aynan shu yerda: bitta hisob bog'langan bo'lsa menyuda
     * "Hisobni almashtirish" ko'rinmaydi (TZ 3.12.2), ya'ni ikkinchi hisobni
     * qo'shishning boshqa yo'li qolmasdi.
     */
    await tx.sendMessage(
      update.chatId,
      `${this.texts.t('settingsHeader', lang)}\n\n${profile}`,
      {
        inline: [
          ...this.texts.languageKeyboard(),
          [{ text: this.texts.addAccountLabel(lang), data: 'acc:add' }],
        ],
      },
    );
  }
}

/**
 * Bu tugmalar ochiq oqimni o'zi hal qiladi: hisob almashtirish va chiqish oqimni
 * bekor qilib **o'z** ogohlantirishini beradi (TZ 3.12.2), sozlamalar va yordam esa
 * oqimga umuman tegmaydi.
 */
const FLOW_NEUTRAL_BUTTONS = new Set<ButtonId>([
  'switchAccount',
  'logout',
  'settings',
  'help',
]);

/** Faqat tasdiqlovchi rollar uchun ekranlar (TZ 3.12.3 menyulari) */
const APPROVER_BUTTONS = new Set<ButtonId>([
  'pendingApprovals',
  'finalApprovals',
  'refundRequests',
  'editRequests',
  'branchExpenses',
  'branchStats',
  'companyStats',
  'employees',
]);
