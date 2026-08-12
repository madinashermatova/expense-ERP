import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ExpenseStatus } from '../../../generated/prisma/enums';
import { ApprovalsService } from '../../expenses/approvals.service';
import { ExpensesService, ExpenseView } from '../../expenses/expenses.service';
import { MIN_REFUND_REASON_LENGTH } from '../../refunds/dto/refund.dto';
import { RefundsService } from '../../refunds/refunds.service';
import { EditRequestsService } from '../../edit-requests/edit-requests.service';
import { BotSession, BotSessionService } from '../bot-session.service';
import {
  ActiveAccount,
  BotTransport,
  BotUpdate,
  InlineButton,
} from '../bot-types';
import { DecisionFlow } from '../flow-state';
import { formatAmount, formatDate } from '../format';
import { MenuPresenter } from '../menu.presenter';
import { extractServiceMessage } from '../service-error';
import { toAppLanguage } from '../../../common/i18n/languages';
import { BotTextService } from '../bot-text.service';

/** Kartochkalar ketma-ket ko'riladi — bir vaqtda bittasi ko'rsatiladi (TZ 3.12.3) */
const PAGE_SIZE = 20;

/** Sabab uzunligi tasdiqlash oqimidagi bilan bir xil (TZ 3.7) */
const MIN_REASON_LENGTH = MIN_REFUND_REASON_LENGTH;

type Stage = 'director' | 'admin';

/**
 * Tasdiqlash, qaytarish va tahrirlash kartochkalari (TZ 3.12.3, 3.7, 3.8, 3.9).
 *
 * Kartochka **bitta yozuv** ko'rinishida chiqadi, ⬅️ ➡️ bilan ketma-ket ko'riladi va
 * qarorlar inline tugmalar bilan qabul qilinadi. Idempotentlik servisda: ikkinchi
 * bosishda `ALREADY_PROCESSED` (409) qaytadi va foydalanuvchiga shu aytiladi —
 * ya'ni bot o'z hisoblagichini yuritmaydi, holat bazadan o'qiladi.
 *
 * Bir nechta hisob bog'langan bo'lsa kartochka sarlavhasiga kompaniya nomi qo'shiladi.
 */
@Injectable()
export class ApprovalsFlowHandler {
  private readonly logger = new Logger(ApprovalsFlowHandler.name);

  constructor(
    private readonly expenses: ExpensesService,
    private readonly approvals: ApprovalsService,
    private readonly refunds: RefundsService,
    private readonly editRequests: EditRequestsService,
    private readonly sessions: BotSessionService,
    private readonly menu: MenuPresenter,
    private readonly texts: BotTextService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Xarajat tasdiqlash
  // ───────────────────────────────────────────────────────────────────────────

  async showApprovals(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    stage: Stage,
    index = 0,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const items = await this.pendingExpenses(stage);

    if (items.length === 0) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('approvalsEmpty', lang),
      );
      return;
    }

    const position = Math.min(Math.max(index, 0), items.length - 1);
    const expense = items[position];

    const lines = [
      this.texts.t('approvalCard', lang, {
        number: expense.globalNumber,
        index: position + 1,
        total: items.length,
        branch: expense.branchName,
        employees: expense.shares
          .map((share) => share.employeeName ?? '')
          .join(', '),
        category: expense.categoryName,
        amount: formatAmount(expense.amount, expense.currency, lang),
        date: formatDate(expense.date),
      }),
    ];

    if (expense.comment) {
      lines.push(
        this.texts.t('approvalComment', lang, { comment: expense.comment }),
      );
    }
    if (expense.files?.length) {
      lines.push(
        this.texts.t('approvalFiles', lang, { count: expense.files.length }),
      );
    }
    // Bir nechta hisob bog'langan bo'lsa kartochkada kompaniya ko'rsatiladi (TZ 3.12.3)
    if ((await this.menu.linkedAccountCount(update)) > 1) {
      lines.push(
        this.texts.t('approvalCompany', lang, { company: active.companyName }),
      );
    }

    const rows: InlineButton[][] = [
      [
        {
          text: this.texts.t('approve', lang),
          data: `apr:ok:${stage}:${expense.id}`,
        },
        {
          text: this.texts.t('rejectAction', lang),
          data: `apr:no:${stage}:${expense.id}`,
        },
      ],
      [
        {
          text: this.texts.t('requestFix', lang),
          data: `apr:fix:${stage}:${expense.id}`,
        },
      ],
    ];

    const navigation = this.navigation(
      `apr:go:${stage}`,
      position,
      items.length,
    );
    if (navigation.length > 0) rows.push(navigation);

    await tx.sendMessage(update.chatId, lines.join('\n'), { inline: rows });
  }

  async handleCallback(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    data: string,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (data.startsWith('apr:go:')) {
      const [, , stage, index] = data.split(':');
      await this.showApprovals(
        tx,
        update,
        session,
        active,
        stage === 'admin' ? 'admin' : 'director',
        Number(index) || 0,
      );
      return;
    }

    if (data.startsWith('apr:ok:')) {
      const [, , stage, id] = data.split(':');
      try {
        const decided = await this.approvals.approve(id);
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('approvedDone', lang, { number: decided.globalNumber }),
        );
      } catch (error) {
        await this.reportDecisionError(tx, update, session, active, error, {
          expenseId: id,
          stage: stage === 'admin' ? 'admin' : 'director',
        });
      }
      return;
    }

    if (data.startsWith('apr:no:') || data.startsWith('apr:fix:')) {
      const [, action, stage, id] = data.split(':');

      await this.askReason(tx, update, session, {
        name: 'decision',
        step: 'reason',
        kind: 'expense',
        targetId: id,
        action: action === 'no' ? 'reject' : 'fix',
        stage: stage === 'admin' ? 'admin' : 'director',
      });
      return;
    }

    if (data.startsWith('rfd:go:')) {
      await this.showRefundRequests(
        tx,
        update,
        session,
        active,
        Number(data.split(':')[3]) || 0,
      );
      return;
    }

    if (data.startsWith('rfd:ok:')) {
      const id = data.slice('rfd:ok:'.length);
      try {
        await this.refunds.approve(id);
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('refundApproved', lang),
        );
      } catch (error) {
        await this.reportDecisionError(tx, update, session, active, error);
      }
      return;
    }

    if (data.startsWith('rfd:no:')) {
      await this.askReason(tx, update, session, {
        name: 'decision',
        step: 'reason',
        kind: 'refund',
        targetId: data.slice('rfd:no:'.length),
        action: 'reject',
      });
      return;
    }

    if (data.startsWith('edt:go:')) {
      await this.showEditRequests(
        tx,
        update,
        session,
        active,
        Number(data.split(':')[3]) || 0,
      );
      return;
    }

    if (data.startsWith('edt:ok:')) {
      const id = data.slice('edt:ok:'.length);
      try {
        await this.editRequests.apply(id);
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('editApplied', lang),
        );
      } catch (error) {
        await this.reportDecisionError(tx, update, session, active, error);
      }
      return;
    }

    if (data.startsWith('edt:no:')) {
      await this.askReason(tx, update, session, {
        name: 'decision',
        step: 'reason',
        kind: 'edit',
        targetId: data.slice('edt:no:'.length),
        action: 'reject',
      });
      return;
    }

    await this.menu.showMain(tx, update, session, active);
  }

  /** Sabab matni kelganda qarorni yakunlaydi (TZ 3.7 — sabab majburiy) */
  async handleReason(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: DecisionFlow,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const reason = update.text?.trim() ?? '';

    if (reason.length < MIN_REASON_LENGTH) {
      await tx.sendMessage(
        update.chatId,
        this.texts.t('reasonTooShort', lang, { min: MIN_REASON_LENGTH }),
      );
      return;
    }

    try {
      let message: string;

      if (flow.kind === 'expense') {
        const decided =
          flow.action === 'reject'
            ? await this.approvals.reject(flow.targetId, reason)
            : await this.approvals.requestFix(flow.targetId, reason);
        message = this.texts.t(
          flow.action === 'reject' ? 'rejectedDone' : 'fixRequestedDone',
          lang,
          { number: decided.globalNumber },
        );
      } else if (flow.kind === 'refund') {
        await this.refunds.reject(flow.targetId, reason);
        message = this.texts.t('refundRejected', lang);
      } else {
        await this.editRequests.reject(flow.targetId, reason);
        message = this.texts.t('editRejected', lang);
      }

      await this.sessions.setFlow(session, null);
      await this.menu.showMain(tx, update, session, active, message);
    } catch (error) {
      await this.sessions.setFlow(session, null);
      await this.reportDecisionError(tx, update, session, active, error, {
        expenseId: flow.kind === 'expense' ? flow.targetId : undefined,
        stage: flow.stage,
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Qaytarish va tahrirlash so'rovlari
  // ───────────────────────────────────────────────────────────────────────────

  async showRefundRequests(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    index = 0,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const page = await this.refunds.list({
      status: 'PENDING',
      page: 1,
      limit: PAGE_SIZE,
    });

    if (page.items.length === 0) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('refundsEmpty', lang),
      );
      return;
    }

    const position = Math.min(Math.max(index, 0), page.items.length - 1);
    const refund = page.items[position];

    const text = this.texts.t('refundCard', lang, {
      number: refund.expenseGlobalNumber,
      index: position + 1,
      total: page.items.length,
      amount: formatAmount(refund.amount, refund.currency, lang),
      reason: refund.reason,
      files: refund.files.length,
    });

    const rows: InlineButton[][] = [
      [
        { text: this.texts.t('approve', lang), data: `rfd:ok:${refund.id}` },
        {
          text: this.texts.t('rejectAction', lang),
          data: `rfd:no:${refund.id}`,
        },
      ],
    ];
    const navigation = this.navigation('rfd:go:x', position, page.items.length);
    if (navigation.length > 0) rows.push(navigation);

    await tx.sendMessage(update.chatId, text, { inline: rows });
  }

  async showEditRequests(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    index = 0,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const page = await this.editRequests.list({
      status: 'PENDING',
      page: 1,
      limit: PAGE_SIZE,
    });

    if (page.items.length === 0) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('editRequestsEmpty', lang),
      );
      return;
    }

    const position = Math.min(Math.max(index, 0), page.items.length - 1);
    const request = page.items[position];

    const text = this.texts.t('editCard', lang, {
      number: request.expenseGlobalNumber,
      index: position + 1,
      total: page.items.length,
      employee: request.requestedBy,
      description: request.description,
    });

    const rows: InlineButton[][] = [
      [
        { text: this.texts.t('editApply', lang), data: `edt:ok:${request.id}` },
        {
          text: this.texts.t('rejectAction', lang),
          data: `edt:no:${request.id}`,
        },
      ],
    ];
    const navigation = this.navigation('edt:go:x', position, page.items.length);
    if (navigation.length > 0) rows.push(navigation);

    await tx.sendMessage(update.chatId, text, { inline: rows });
  }

  // ───────────────────────────────────────────────────────────────────────────

  private async askReason(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    flow: DecisionFlow,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    await this.sessions.setFlow(session, flow);
    await tx.sendMessage(
      update.chatId,
      this.texts.t('askReason', lang, { min: MIN_REASON_LENGTH }),
    );
  }

  /**
   * Direktor 1-bosqichni, bosh admin ikkalasini ham ko'radi. "Yakuniy tasdiqlash"
   * tugmasi ataylab alohida: admin uchun bu ikki xil navbat (TZ 3.12.3).
   */
  private async pendingExpenses(stage: Stage): Promise<ExpenseView[]> {
    const page = await this.expenses.list({
      status: [
        stage === 'admin'
          ? ExpenseStatus.ADMIN_PENDING
          : ExpenseStatus.DIRECTOR_PENDING,
      ],
      page: 1,
      limit: PAGE_SIZE,
      sort: 'createdAt',
      order: 'asc',
    });

    return page.items;
  }

  private async stageAlreadyPassed(
    expenseId: string,
    stage: 'director' | 'admin',
  ): Promise<boolean> {
    const expected =
      stage === 'admin'
        ? ExpenseStatus.ADMIN_PENDING
        : ExpenseStatus.DIRECTOR_PENDING;

    try {
      const expense = await this.expenses.findOne(expenseId);
      return expense.status !== expected;
    } catch {
      return false;
    }
  }

  private navigation(
    prefix: string,
    position: number,
    total: number,
  ): InlineButton[] {
    const base = prefix.endsWith(':x') ? prefix.slice(0, -2) : prefix;
    const row: InlineButton[] = [];

    if (position > 0) {
      row.push({ text: '⬅️', data: `${base}:${position - 1}` });
    }
    if (position < total - 1) {
      row.push({ text: '➡️', data: `${base}:${position + 1}` });
    }

    return row;
  }

  /**
   * Ikki marta bosish (TZ 3.12.3 qabul mezoni).
   *
   * Servis ikki xil javob beradi: yozuv o'sha statusda qolgan bo'lsa optimistik qulf
   * `ALREADY_PROCESSED` (409) qaytaradi, status allaqachon keyingi bosqichga o'tgan
   * bo'lsa esa "bu bosqich sizga tegishli emas" degan 403. Ikkinchisi ham aslida
   * "allaqachon qayta ishlangan" — shuning uchun kartochka ochilgan bosqich bilan
   * joriy status solishtiriladi.
   */
  private async reportDecisionError(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    error: unknown,
    context: {
      expenseId?: string;
      stage?: 'director' | 'admin';
    } = {},
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (
      context.expenseId &&
      context.stage &&
      (await this.stageAlreadyPassed(context.expenseId, context.stage))
    ) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('alreadyProcessed', lang),
      );
      return;
    }

    if (error instanceof ConflictException) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('alreadyProcessed', lang),
      );
      return;
    }

    const message = extractServiceMessage(error);
    this.logger.warn(`Bot qarori bajarilmadi: ${message ?? "noma'lum xato"}`);
    await this.menu.showMain(
      tx,
      update,
      session,
      active,
      message ?? this.texts.t('serverError', lang),
    );
  }
}
