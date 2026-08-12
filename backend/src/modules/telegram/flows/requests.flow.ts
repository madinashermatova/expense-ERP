import { Injectable, Logger } from '@nestjs/common';
import { Money } from '../../../common/money/money';
import { ExpenseStatus } from '../../../generated/prisma/enums';
import { EditRequestsService } from '../../edit-requests/edit-requests.service';
import { MIN_EDIT_REQUEST_LENGTH } from '../../edit-requests/dto/edit-request.dto';
import { ExpensesService, ExpenseView } from '../../expenses/expenses.service';
import { MIN_REFUND_REASON_LENGTH } from '../../refunds/dto/refund.dto';
import { RefundsService } from '../../refunds/refunds.service';
import { langOf, t } from '../bot-texts';
import { BotSession, BotSessionService } from '../bot-session.service';
import {
  ActiveAccount,
  BotTransport,
  BotUpdate,
  InlineButton,
} from '../bot-types';
import { EditRequestFlow, PendingFile, RefundFlow } from '../flow-state';
import { formatAmount, formatDate, parseAmount } from '../format';
import { MenuPresenter } from '../menu.presenter';
import { extractServiceMessage } from '../service-error';

/** Tanlash uchun ko'rsatiladigan xarajatlar soni */
const CHOICES = 8;

/**
 * Ishchi tomonidan yuborilgan so'rovlar: pulni qaytarish (TZ 3.9) va tahrirlash
 * murojaati (TZ 3.8).
 *
 * Ikkisi bir faylda, chunki oqim shakli bir xil: **o'z xarajatini tanlash → matn →
 * (qaytarishda) isbot → yuborish**. Ikkisida ham yozuv `RefundsService` /
 * `EditRequestsService` orqali yaratiladi — qoida (isbot majburiy, summa xarajat
 * qoldig'idan oshmaydi, 24 soatlik oyna) servisda qoladi.
 */
@Injectable()
export class RequestsFlowHandler {
  private readonly logger = new Logger(RequestsFlowHandler.name);

  constructor(
    private readonly expenses: ExpensesService,
    private readonly refunds: RefundsService,
    private readonly editRequests: EditRequestsService,
    private readonly sessions: BotSessionService,
    private readonly menu: MenuPresenter,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Qaytarish
  // ───────────────────────────────────────────────────────────────────────────

  async startRefund(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
  ): Promise<void> {
    const lang = langOf(session.language);
    const items = await this.refundableExpenses(active);

    if (items.length === 0) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        t('refundNoExpenses', lang),
      );
      return;
    }

    await this.sessions.setFlow(session, { name: 'refund', step: 'expense' });
    await tx.sendMessage(update.chatId, t('refundChooseExpense', lang), {
      inline: [
        ...this.expenseButtons(items, 'rfd:exp', lang),
        [{ text: t('cancel', lang), data: 'rfd:cancel' }],
      ],
    });
  }

  async handleRefundCallback(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: RefundFlow,
    data: string,
  ): Promise<void> {
    const lang = langOf(session.language);

    if (data === 'rfd:cancel') {
      await this.sessions.setFlow(session, null);
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        t('cancelled', lang),
      );
      return;
    }

    if (data.startsWith('rfd:exp:')) {
      const expense = await this.expenses.findOne(
        data.slice('rfd:exp:'.length),
      );
      const remaining = Money.round2(expense.amount).sub(
        Money.round2(expense.refundedAmount),
      );

      flow.expenseId = expense.id;
      flow.expenseNumber = expense.globalNumber;
      flow.maxAmount = Money.toString(remaining);
      flow.step = 'amount';
      await this.sessions.setFlow(session, flow);

      await tx.sendMessage(
        update.chatId,
        t('refundAskAmount', lang, {
          max: formatAmount(flow.maxAmount, expense.currency, lang),
        }),
        { inline: [[{ text: t('cancel', lang), data: 'rfd:cancel' }]] },
      );
      return;
    }

    if (data === 'rfd:send') {
      await this.submitRefund(tx, update, session, active, flow);
    }
  }

  async handleRefundInput(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: RefundFlow,
  ): Promise<void> {
    const lang = langOf(session.language);
    const cancelRow: InlineButton[] = [
      { text: t('cancel', lang), data: 'rfd:cancel' },
    ];

    if (flow.step === 'proof') {
      const fileId = update.photoFileId ?? update.documentFileId;
      if (!fileId) {
        await tx.sendMessage(update.chatId, t('refundAskProof', lang), {
          inline: [cancelRow],
        });
        return;
      }

      const files: PendingFile[] = flow.files ?? [];
      files.push({
        fileId,
        name: update.documentName ?? `isbot-${files.length + 1}.jpg`,
      });
      flow.files = files;
      flow.step = 'confirm';
      await this.sessions.setFlow(session, flow);

      await tx.sendMessage(
        update.chatId,
        [
          t('confirmHeader', lang),
          `🧾 ${flow.expenseNumber ?? ''}`,
          `💰 ${flow.amount ?? ''}`,
          `📝 ${flow.reason ?? ''}`,
          `📎 ${files.length}`,
        ].join('\n'),
        {
          inline: [
            [{ text: t('confirmSend', lang), data: 'rfd:send' }],
            cancelRow,
          ],
        },
      );
      return;
    }

    const text = update.text?.trim() ?? '';

    if (flow.step === 'amount') {
      const parsed = parseAmount(text);
      if (!parsed) {
        await tx.sendMessage(update.chatId, t('amountInvalid', lang), {
          inline: [cancelRow],
        });
        return;
      }

      if (
        flow.maxAmount &&
        Money.round2(parsed.amount).greaterThan(Money.round2(flow.maxAmount))
      ) {
        await tx.sendMessage(
          update.chatId,
          t('refundAmountTooBig', lang, { max: flow.maxAmount }),
          { inline: [cancelRow] },
        );
        return;
      }

      flow.amount = parsed.amount;
      flow.step = 'reason';
      await this.sessions.setFlow(session, flow);
      await tx.sendMessage(
        update.chatId,
        t('refundAskReason', lang, { min: MIN_REFUND_REASON_LENGTH }),
        { inline: [cancelRow] },
      );
      return;
    }

    if (flow.step === 'reason') {
      if (text.length < MIN_REFUND_REASON_LENGTH) {
        await tx.sendMessage(
          update.chatId,
          t('reasonTooShort', lang, { min: MIN_REFUND_REASON_LENGTH }),
          { inline: [cancelRow] },
        );
        return;
      }

      flow.reason = text;
      flow.step = 'proof';
      await this.sessions.setFlow(session, flow);
      await tx.sendMessage(update.chatId, t('refundAskProof', lang), {
        inline: [cancelRow],
      });
    }
  }

  private async submitRefund(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: RefundFlow,
  ): Promise<void> {
    const lang = langOf(session.language);

    try {
      const files = await Promise.all(
        (flow.files ?? []).map(async (file) => {
          const buffer = await tx.downloadFile(file.fileId);
          return {
            originalname: file.name,
            // Turi mazmun imzosidan aniqlanadi (`file-type.util.ts`)
            mimetype: '',
            size: buffer.length,
            buffer,
          };
        }),
      );

      const refund = await this.refunds.create(
        {
          expenseId: flow.expenseId!,
          amount: flow.amount!,
          reason: flow.reason!,
        },
        files,
      );

      await this.sessions.setFlow(session, null);
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        t('refundSubmitted', lang, { number: refund.expenseGlobalNumber }),
      );
    } catch (error) {
      const message = extractServiceMessage(error);
      this.logger.warn(`Bot qaytarish so'rovi yaratilmadi: ${message ?? ''}`);
      await this.sessions.setFlow(session, null);
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        message ?? t('serverError', lang),
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Tahrirlash murojaati
  // ───────────────────────────────────────────────────────────────────────────

  async startEditRequest(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
  ): Promise<void> {
    const lang = langOf(session.language);
    const items = await this.ownExpenses(active);

    if (items.length === 0) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        t('editNoExpenses', lang),
      );
      return;
    }

    await this.sessions.setFlow(session, {
      name: 'editRequest',
      step: 'expense',
    });
    await tx.sendMessage(update.chatId, t('editChooseExpense', lang), {
      inline: [
        ...this.expenseButtons(items, 'edt:exp', lang),
        [{ text: t('cancel', lang), data: 'edt:cancel' }],
      ],
    });
  }

  async handleEditCallback(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: EditRequestFlow,
    data: string,
  ): Promise<void> {
    const lang = langOf(session.language);

    if (data === 'edt:cancel') {
      await this.sessions.setFlow(session, null);
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        t('cancelled', lang),
      );
      return;
    }

    if (data.startsWith('edt:exp:')) {
      const expense = await this.expenses.findOne(
        data.slice('edt:exp:'.length),
      );

      flow.expenseId = expense.id;
      flow.expenseNumber = expense.globalNumber;
      flow.step = 'description';
      await this.sessions.setFlow(session, flow);

      await tx.sendMessage(
        update.chatId,
        t('editAskDescription', lang, { min: MIN_EDIT_REQUEST_LENGTH }),
        { inline: [[{ text: t('cancel', lang), data: 'edt:cancel' }]] },
      );
    }
  }

  async handleEditInput(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: EditRequestFlow,
  ): Promise<void> {
    const lang = langOf(session.language);
    const text = update.text?.trim() ?? '';

    if (flow.step !== 'description') return;

    if (text.length < MIN_EDIT_REQUEST_LENGTH) {
      await tx.sendMessage(
        update.chatId,
        t('reasonTooShort', lang, { min: MIN_EDIT_REQUEST_LENGTH }),
        { inline: [[{ text: t('cancel', lang), data: 'edt:cancel' }]] },
      );
      return;
    }

    try {
      const request = await this.editRequests.create({
        expenseId: flow.expenseId!,
        description: text,
      });

      await this.sessions.setFlow(session, null);
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        t('editSubmitted', lang, { number: request.expenseGlobalNumber }),
      );
    } catch (error) {
      const message = extractServiceMessage(error);
      this.logger.warn(
        `Bot tahrirlash murojaati yaratilmadi: ${message ?? ''}`,
      );
      await this.sessions.setFlow(session, null);
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        message ?? t('serverError', lang),
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────

  /** Qaytarish faqat tasdiqlangan (yoki qisman qaytarilgan) xarajat bo'yicha (TZ 3.9) */
  private async refundableExpenses(
    active: ActiveAccount,
  ): Promise<ExpenseView[]> {
    const page = await this.expenses.list({
      ...(active.employeeId ? { employeeId: active.employeeId } : {}),
      status: [ExpenseStatus.APPROVED, ExpenseStatus.PARTIALLY_REFUNDED],
      page: 1,
      limit: CHOICES,
      sort: 'date',
      order: 'desc',
    });

    return page.items;
  }

  private async ownExpenses(active: ActiveAccount): Promise<ExpenseView[]> {
    const page = await this.expenses.list({
      ...(active.employeeId ? { employeeId: active.employeeId } : {}),
      page: 1,
      limit: CHOICES,
      sort: 'date',
      order: 'desc',
    });

    return page.items;
  }

  private expenseButtons(
    items: ExpenseView[],
    prefix: string,
    lang: ReturnType<typeof langOf>,
  ): InlineButton[][] {
    return items.map((item) => [
      {
        text: `${item.globalNumber} · ${formatAmount(item.amount, item.currency, lang)} · ${formatDate(item.date)}`,
        data: `${prefix}:${item.id}`,
      },
    ]);
  }
}
