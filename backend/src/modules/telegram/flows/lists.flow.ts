import { Injectable } from '@nestjs/common';
import { Currency, ExpenseStatus, Role } from '../../../generated/prisma/enums';
import { ExpensesService } from '../../expenses/expenses.service';
import { ReportsService } from '../../reports/reports.service';
import { BotSession } from '../bot-session.service';
import { ActiveAccount, BotTransport, BotUpdate } from '../bot-types';
import { formatAmount, formatDate } from '../format';
import { MenuPresenter } from '../menu.presenter';
import { toAppLanguage } from '../../../common/i18n/languages';
import { BotTextService } from '../bot-text.service';

/** Bot xabari uzun bo'lmasligi kerak — oxirgi yozuvlargina ko'rsatiladi */
const LIST_LIMIT = 5;

/**
 * Ro'yxat va statistika ekranlari (TZ 3.12.3).
 *
 * Ma'lumot mavjud servislardan olinadi: ro'yxat `ExpensesService.list`, statistika
 * `ReportsService.summary`. Shu tanlov muhim — filial doirasi (direktor faqat o'z
 * filialini ko'radi) va "faqat tasdiqlangan sarf hisoblanadi" qoidasi bir joyda
 * qoladi, bot esa ularni qayta yozmaydi.
 *
 * Ishchining statistikasi `employeeId` filtri bilan olinadi: rol bo'yicha doira
 * ishchini cheklamaydi, ulush bo'yicha filtr esa aynan o'z xarajatlarini qoldiradi.
 */
@Injectable()
export class ListsFlowHandler {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly reports: ReportsService,
    private readonly menu: MenuPresenter,
    private readonly texts: BotTextService,
  ) {}

  async myExpenses(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (!active.employeeId) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('employeeMissing', lang),
      );
      return;
    }

    const page = await this.expenses.list({
      employeeId: active.employeeId,
      page: 1,
      limit: LIST_LIMIT,
      sort: 'date',
      order: 'desc',
    });

    await this.menu.showMain(
      tx,
      update,
      session,
      active,
      this.renderList(
        session,
        this.texts.t('myExpensesHeader', lang),
        page.items,
      ),
    );
  }

  async branchExpenses(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    // Direktor uchun filial filtri servisda majburlanadi (BranchScopeService)
    const page = await this.expenses.list({
      page: 1,
      limit: LIST_LIMIT,
      sort: 'date',
      order: 'desc',
    });

    await this.menu.showMain(
      tx,
      update,
      session,
      active,
      this.renderList(
        session,
        this.texts.t('branchExpensesHeader', lang),
        page.items,
      ),
    );
  }

  /** Ishchi uchun o'z statistikasi, direktor/admin uchun doirasidagi umumiy */
  async stats(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    scope: 'own' | 'scoped',
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (scope === 'own' && !active.employeeId) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('employeeMissing', lang),
      );
      return;
    }

    const summary = await this.reports.summary(
      scope === 'own' ? { employeeId: active.employeeId! } : {},
    );

    const lines = [
      this.texts.t('statsHeader', lang, {
        from: formatDate(summary.period.from),
        to: formatDate(summary.period.to),
        total: `${summary.totalUzs} UZS`,
        count: summary.expenseCount,
        refunded: `${summary.refundedUzs} UZS`,
      }),
    ];

    // Kutilayotgan arizalar soni faqat tasdiqlovchilarga ma'noli
    if (active.role !== Role.WORKER) {
      lines.push(
        this.texts.t('statsPending', lang, {
          director: summary.pendingDirectorCount,
          admin: summary.pendingAdminCount,
        }),
      );
    }

    await this.menu.showMain(tx, update, session, active, lines.join('\n'));
  }

  private renderList(
    session: BotSession,
    header: string,
    items: {
      globalNumber: string;
      categoryName: string;
      amount: string;
      currency: Currency;
      date: string;
      status: ExpenseStatus;
    }[],
  ): string {
    const lang = toAppLanguage(session.language);
    if (items.length === 0) return this.texts.t('expensesEmpty', lang);

    const lines = items.map((item) =>
      [
        `🧾 ${item.globalNumber} — ${formatAmount(item.amount, item.currency, lang)}`,
        `   📂 ${item.categoryName} · 📅 ${formatDate(item.date)}`,
        `   ${this.texts.statusName(item.status, lang)}`,
      ].join('\n'),
    );

    return [header, ...lines].join('\n');
  }
}
