import { Injectable, Logger } from '@nestjs/common';
import { Money } from '../../../common/money/money';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CategoryStatus,
  Currency,
  EmployeeStatus,
  ExpenseStatus,
  PaymentMethod,
} from '../../../generated/prisma/enums';
import { ApprovalsService } from '../../expenses/approvals.service';
import {
  CreateExpenseResult,
  ExpensesService,
} from '../../expenses/expenses.service';
import { BotSession, BotSessionService } from '../bot-session.service';
import {
  ActiveAccount,
  BotTransport,
  BotUpdate,
  InlineButton,
} from '../bot-types';
import { ExpenseFlow, ExpenseStep, PendingFile } from '../flow-state';
import {
  formatAmount,
  formatDate,
  isoToday,
  parseAmount,
  parseDate,
} from '../format';
import { MenuPresenter } from '../menu.presenter';
import { extractServiceMessage } from '../service-error';
import { AppLanguage, toAppLanguage } from '../../../common/i18n/languages';
import { BotTextService } from '../bot-text.service';

/** Bir sahifada ko'rsatiladigan xodim soni — Telegram inline klaviaturasi cheklangan */
const EMPLOYEES_PER_PAGE = 8;

/**
 * Xarajat qo'shish sahnasi (TZ 3.12.3).
 *
 * Qadamlar: kategoriya → kim uchun → (taqsimlash) → summa → sana → izoh → chek →
 * tasdiqlash. Har qadamda ⬅️ **Orqaga** va ❌ **Bekor qilish** bo'ladi, "Orqaga"
 * kiritilgan ma'lumotni saqlab qoladi — shuning uchun holatda `history` bor:
 * qadamlar shartli (guruh tanlanmasa taqsimlash bosqichi umuman bo'lmaydi), ya'ni
 * "oldingi qadam" ni qadamlar ro'yxatidan hisoblab bo'lmaydi.
 *
 * Yozuv **mavjud servislar orqali** yaratiladi (`ExpensesService.create`,
 * `ApprovalsService.submit`): validatsiya, raqamlash, byudjet ogohlantirishlari va
 * audit bir joyda qolishi kerak — bot ularni takrorlamaydi.
 */
@Injectable()
export class ExpenseFlowHandler {
  private readonly logger = new Logger(ExpenseFlowHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expenses: ExpensesService,
    private readonly approvals: ApprovalsService,
    private readonly sessions: BotSessionService,
    private readonly menu: MenuPresenter,
    private readonly texts: BotTextService,
  ) {}

  async start(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (!active.branchId) {
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('branchMissing', lang),
      );
      return;
    }

    const flow: ExpenseFlow = {
      name: 'expense',
      step: 'category',
      history: [],
    };
    await this.sessions.setFlow(session, flow);
    await this.render(tx, update, session, active, flow);
  }

  /** Matnli qadamlar: summa, ulushlar, sana, izoh; chek uchun rasm/hujjat */
  async handleText(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (update.photoFileId || update.documentFileId) {
      await this.acceptFile(tx, update, session, active, flow);
      return;
    }

    const text = update.text?.trim();
    if (!text) {
      await this.render(tx, update, session, active, flow);
      return;
    }

    switch (flow.step) {
      case 'amount': {
        const parsed = parseAmount(text);
        if (!parsed) {
          await this.render(
            tx,
            update,
            session,
            active,
            flow,
            this.texts.t('amountInvalid', lang),
          );
          return;
        }
        flow.amount = parsed.amount;
        flow.currency = parsed.currency;
        await this.goto(tx, update, session, active, flow, 'date');
        return;
      }

      case 'shares': {
        await this.acceptShare(tx, update, session, active, flow, text);
        return;
      }

      case 'date': {
        const date = parseDate(text);
        if (!date) {
          await this.render(
            tx,
            update,
            session,
            active,
            flow,
            this.texts.t('dateInvalid', lang),
          );
          return;
        }
        flow.date = date;
        await this.goto(tx, update, session, active, flow, 'comment');
        return;
      }

      case 'comment': {
        flow.comment = text;
        await this.goto(tx, update, session, active, flow, 'receipt');
        return;
      }

      default:
        // Bu qadamlarda tugma kutiladi — ekranni qayta ko'rsatish eng tushunarli javob
        await this.render(tx, update, session, active, flow);
    }
  }

  /** Inline tugmalar: `exp:*` */
  async handleCallback(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
    data: string,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (data === 'exp:cancel') {
      await this.sessions.setFlow(session, null);
      await this.menu.showMain(
        tx,
        update,
        session,
        active,
        this.texts.t('cancelled', lang),
      );
      return;
    }

    if (data === 'exp:back') {
      const previous = flow.history.pop();
      if (!previous) {
        await this.sessions.setFlow(session, null);
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('cancelled', lang),
        );
        return;
      }
      flow.step = previous;
      await this.sessions.setFlow(session, flow);
      await this.render(tx, update, session, active, flow);
      return;
    }

    if (data.startsWith('exp:cat:')) {
      await this.chooseCategory(
        tx,
        update,
        session,
        active,
        flow,
        data.slice('exp:cat:'.length),
      );
      return;
    }

    if (data.startsWith('exp:target:')) {
      await this.chooseTarget(
        tx,
        update,
        session,
        active,
        flow,
        data.slice('exp:target:'.length),
      );
      return;
    }

    if (data.startsWith('exp:emp:')) {
      await this.toggleEmployee(
        tx,
        update,
        session,
        active,
        flow,
        data.slice('exp:emp:'.length),
      );
      return;
    }

    if (data.startsWith('exp:page:')) {
      flow.page = Number(data.slice('exp:page:'.length)) || 0;
      await this.sessions.setFlow(session, flow);
      await this.render(tx, update, session, active, flow);
      return;
    }

    if (data === 'exp:empDone') {
      if (!flow.employeeIds?.length) {
        await this.render(
          tx,
          update,
          session,
          active,
          flow,
          this.texts.t('selectAtLeastOne', lang),
        );
        return;
      }
      await this.goto(tx, update, session, active, flow, 'split');
      return;
    }

    if (data.startsWith('exp:split:')) {
      flow.split = data.endsWith('manual') ? 'manual' : 'equal';
      flow.shares = [];
      await this.goto(
        tx,
        update,
        session,
        active,
        flow,
        flow.split === 'manual' ? 'shares' : 'amount',
      );
      return;
    }

    if (data === 'exp:today') {
      flow.date = isoToday();
      await this.goto(tx, update, session, active, flow, 'comment');
      return;
    }

    if (data === 'exp:skip') {
      if (flow.step === 'comment') {
        flow.comment = undefined;
        await this.goto(tx, update, session, active, flow, 'receipt');
        return;
      }
      if (flow.step === 'receipt') {
        await this.goto(tx, update, session, active, flow, 'confirm');
        return;
      }
    }

    if (data === 'exp:receiptDone') {
      await this.goto(tx, update, session, active, flow, 'confirm');
      return;
    }

    if (data === 'exp:edit') {
      // "Tahrirlash" — boshidan boshlanadi, lekin kiritilgan ma'lumot saqlanadi
      flow.history.push('confirm');
      flow.step = 'category';
      await this.sessions.setFlow(session, flow);
      await this.render(tx, update, session, active, flow);
      return;
    }

    if (data === 'exp:send') {
      await this.submit(tx, update, session, active, flow);
      return;
    }

    await this.render(tx, update, session, active, flow);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Qadamlar
  // ───────────────────────────────────────────────────────────────────────────

  private async chooseCategory(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
    categoryId: string,
  ): Promise<void> {
    const children = await this.prisma.db.category.findMany({
      where: { parentId: categoryId, status: CategoryStatus.ACTIVE },
      orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }],
    });

    const category = await this.prisma.db.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      await this.render(tx, update, session, active, flow);
      return;
    }

    // Quyi kategoriyasi bo'lgan tarmoqqa xarajat yozilmaydi — barg tanlanishi kerak
    if (children.length > 0) {
      flow.parentCategoryId = categoryId;
      flow.categoryName = category.nameUz;
      await this.goto(tx, update, session, active, flow, 'subcategory');
      return;
    }

    flow.categoryId = categoryId;
    flow.categoryName = flow.parentCategoryId
      ? `${flow.categoryName ?? ''} → ${category.nameUz}`
      : category.nameUz;
    await this.goto(tx, update, session, active, flow, 'target');
  }

  private async chooseTarget(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
    target: string,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (target === 'self') {
      if (!active.employeeId) {
        await this.sessions.setFlow(session, null);
        await this.menu.showMain(
          tx,
          update,
          session,
          active,
          this.texts.t('employeeMissing', lang),
        );
        return;
      }
      flow.target = 'self';
      flow.employeeIds = [active.employeeId];
      flow.split = 'equal';
      await this.goto(tx, update, session, active, flow, 'amount');
      return;
    }

    flow.target = target === 'group' ? 'group' : 'other';
    flow.employeeIds = [];
    flow.page = 0;
    await this.goto(tx, update, session, active, flow, 'employees');
  }

  private async toggleEmployee(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
    employeeId: string,
  ): Promise<void> {
    if (flow.target === 'other') {
      flow.employeeIds = [employeeId];
      flow.split = 'equal';
      await this.goto(tx, update, session, active, flow, 'amount');
      return;
    }

    const selected = new Set(flow.employeeIds ?? []);
    if (selected.has(employeeId)) {
      selected.delete(employeeId);
    } else {
      selected.add(employeeId);
    }
    flow.employeeIds = [...selected];

    await this.sessions.setFlow(session, flow);
    await this.render(tx, update, session, active, flow);
  }

  private async acceptShare(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
    text: string,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const parsed = parseAmount(text);
    if (!parsed) {
      await this.render(
        tx,
        update,
        session,
        active,
        flow,
        this.texts.t('amountInvalid', lang),
      );
      return;
    }

    const employeeIds = flow.employeeIds ?? [];
    const shares = flow.shares ?? [];
    shares.push({
      employeeId: employeeIds[shares.length],
      amount: parsed.amount,
    });
    flow.shares = shares;

    if (shares.length < employeeIds.length) {
      await this.sessions.setFlow(session, flow);
      await this.render(tx, update, session, active, flow);
      return;
    }

    // Ulushlar to'plandi — umumiy summa shundan hisoblanadi, ya'ni qaytadan so'ralmaydi
    flow.amount = Money.toString(
      shares.reduce(
        (sum, share) => sum.add(Money.round2(share.amount)),
        Money.round2(0),
      ),
    );
    flow.currency = flow.currency ?? Currency.UZS;
    await this.goto(tx, update, session, active, flow, 'date');
  }

  private async acceptFile(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    if (flow.step !== 'receipt') {
      await this.render(tx, update, session, active, flow);
      return;
    }

    const fileId = update.photoFileId ?? update.documentFileId;
    if (!fileId) return;

    const files: PendingFile[] = flow.files ?? [];
    files.push({
      fileId,
      name: update.documentName ?? `chek-${files.length + 1}.jpg`,
    });
    flow.files = files;
    await this.sessions.setFlow(session, flow);

    await tx.sendMessage(
      update.chatId,
      this.texts.t('receiptAdded', lang, { count: files.length }),
      {
        inline: [
          [{ text: this.texts.t('next', lang), data: 'exp:receiptDone' }],
          this.navRow(lang),
        ],
      },
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Yakunlash
  // ───────────────────────────────────────────────────────────────────────────

  private async submit(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);

    let created: CreateExpenseResult;
    try {
      created = await this.expenses.create({
        branchId: active.branchId!,
        categoryId: flow.categoryId!,
        employeeIds: flow.employeeIds ?? [],
        amount: flow.amount!,
        currency: flow.currency ?? Currency.UZS,
        date: flow.date ?? isoToday(),
        comment: flow.comment,
        // Bot da to'lov usuli so'ralmaydi (TZ 3.12.3) — naqd eng keng tarqalgan holat
        paymentMethod: PaymentMethod.CASH,
        shares: flow.split === 'manual' ? flow.shares : undefined,
      });
    } catch (error) {
      await this.reportFailure(tx, update, session, active, flow, error);
      return;
    }

    const lines: string[] = [];
    let status = created.status;

    if (flow.files?.length) {
      try {
        const uploads = await Promise.all(
          flow.files.map(async (file) => {
            const buffer = await tx.downloadFile(file.fileId);
            return {
              originalname: file.name,
              /*
               * Tur ataylab bo'sh: Telegram rasmni o'zi qayta kodlaydi va e'lon
               * qilingan turga ishonib bo'lmaydi. `FilesService` mazmun imzosidan
               * (magic bytes) haqiqiy turni o'zi aniqlaydi.
               */
              mimetype: '',
              size: buffer.length,
              buffer,
            };
          }),
        );
        await this.expenses.attachFiles(created.id, uploads);
      } catch (error) {
        this.logger.warn(
          `Bot chekini biriktirib bo'lmadi: expense=${created.id}`,
          error instanceof Error ? error.message : undefined,
        );
        lines.push(
          this.texts.t('fileFailed', lang, { number: created.globalNumber }),
        );
      }
    }

    /*
     * `receiptRequired` kategoriyada yozuv `DRAFT` bo'lib yaratiladi va chek
     * biriktirilgandan keyingina oqimga uzatiladi (`ApprovalsService.submit`) —
     * shu tartib web bilan bir xil bo'lishi kerak.
     */
    if (status === ExpenseStatus.DRAFT) {
      try {
        const submitted = await this.approvals.submit(created.id);
        status = submitted.status;
      } catch (error) {
        this.logger.warn(
          `Bot xarajatini yuborib bo'lmadi: expense=${created.id}`,
          error instanceof Error ? error.message : undefined,
        );
      }
    }

    if (created.duplicateWarning) {
      lines.push(
        this.texts.t('duplicateWarning', lang, {
          number: created.duplicateWarning.globalNumber,
        }),
      );
    }

    for (const warning of created.budgetWarning ?? []) {
      lines.push(
        this.texts.t('budgetWarningLine', lang, {
          warning: `${warning.scopeName ?? ''} — ${warning.usedPercent}% (${this.texts.t('budgetLimit', lang)} ${warning.limit})`,
        }),
      );
    }

    const headline =
      status === ExpenseStatus.DRAFT
        ? this.texts.t('expenseDraft', lang, { number: created.globalNumber })
        : status === ExpenseStatus.ADMIN_PENDING
          ? this.texts.t('expenseSubmittedAdmin', lang, {
              number: created.globalNumber,
            })
          : this.texts.t('expenseSubmitted', lang, {
              number: created.globalNumber,
            });

    await this.sessions.setFlow(session, null);
    await this.menu.showMain(
      tx,
      update,
      session,
      active,
      [headline, ...lines].join('\n'),
    );
  }

  /** Servis validatsiyasi rad etganda xabarni foydalanuvchiga tushunarli qaytaradi */
  private async reportFailure(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
    error: unknown,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const message = extractServiceMessage(error);

    this.logger.warn(`Bot xarajati yaratilmadi: ${message}`);
    await this.render(
      tx,
      update,
      session,
      active,
      flow,
      message ?? this.texts.t('serverError', lang),
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Ekranlar
  // ───────────────────────────────────────────────────────────────────────────

  private async goto(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
    step: ExpenseStep,
  ): Promise<void> {
    flow.history.push(flow.step);
    flow.step = step;
    await this.sessions.setFlow(session, flow);
    await this.render(tx, update, session, active, flow);
  }

  private async render(
    tx: BotTransport,
    update: BotUpdate,
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
    prefix?: string,
  ): Promise<void> {
    const lang = toAppLanguage(session.language);
    const head = prefix ? `${prefix}\n\n` : '';

    switch (flow.step) {
      case 'category':
      case 'subcategory': {
        const parentId =
          flow.step === 'subcategory' ? flow.parentCategoryId! : null;
        const categories = await this.prisma.db.category.findMany({
          where: { parentId, status: CategoryStatus.ACTIVE },
          orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }],
        });

        if (categories.length === 0) {
          await this.sessions.setFlow(session, null);
          await this.menu.showMain(
            tx,
            update,
            session,
            active,
            this.texts.t('noCategories', lang),
          );
          return;
        }

        const label =
          flow.step === 'subcategory'
            ? this.texts.t('askSubcategory', lang, {
                category: flow.categoryName ?? '',
              })
            : this.texts.t('askCategory', lang);

        await tx.sendMessage(update.chatId, head + label, {
          inline: [
            ...categories.map((category) => [
              {
                text:
                  lang === 'ru' && category.nameRu
                    ? category.nameRu
                    : category.nameUz,
                data: `exp:cat:${category.id}`,
              },
            ]),
            this.navRow(lang),
          ],
        });
        return;
      }

      case 'target': {
        await tx.sendMessage(
          update.chatId,
          head + this.texts.t('askTarget', lang),
          {
            inline: [
              [
                {
                  text: this.texts.t('targetSelf', lang),
                  data: 'exp:target:self',
                },
              ],
              [
                {
                  text: this.texts.t('targetOther', lang),
                  data: 'exp:target:other',
                },
              ],
              [
                {
                  text: this.texts.t('targetGroup', lang),
                  data: 'exp:target:group',
                },
              ],
              this.navRow(lang),
            ],
          },
        );
        return;
      }

      case 'employees': {
        const employees = await this.prisma.db.employee.findMany({
          where: {
            branchId: active.branchId!,
            status: EmployeeStatus.ACTIVE,
          },
          orderBy: { fullName: 'asc' },
        });

        if (employees.length === 0) {
          // Ortga qaytish: "kim uchun" qadamiga, xabar bilan
          flow.step = 'target';
          await this.sessions.setFlow(session, flow);
          await this.render(
            tx,
            update,
            session,
            active,
            flow,
            this.texts.t('noEmployees', lang),
          );
          return;
        }

        const page = flow.page ?? 0;
        const pageCount = Math.ceil(employees.length / EMPLOYEES_PER_PAGE);
        const visible = employees.slice(
          page * EMPLOYEES_PER_PAGE,
          (page + 1) * EMPLOYEES_PER_PAGE,
        );
        const selected = new Set(flow.employeeIds ?? []);

        const rows: InlineButton[][] = visible.map((employee) => [
          {
            text: `${selected.has(employee.id) ? '✅ ' : ''}${employee.fullName}`,
            data: `exp:emp:${employee.id}`,
          },
        ]);

        if (pageCount > 1) {
          const paging: InlineButton[] = [];
          if (page > 0) {
            paging.push({ text: '⬅️', data: `exp:page:${page - 1}` });
          }
          if (page < pageCount - 1) {
            paging.push({ text: '➡️', data: `exp:page:${page + 1}` });
          }
          rows.push(paging);
        }

        if (flow.target === 'group') {
          rows.push([
            { text: this.texts.t('next', lang), data: 'exp:empDone' },
          ]);
        }
        rows.push(this.navRow(lang));

        const label =
          flow.target === 'group'
            ? this.texts.t('askEmployees', lang, { count: selected.size })
            : this.texts.t('askEmployee', lang);

        await tx.sendMessage(update.chatId, head + label, { inline: rows });
        return;
      }

      case 'split': {
        await tx.sendMessage(
          update.chatId,
          head + this.texts.t('askSplit', lang),
          {
            inline: [
              [
                {
                  text: this.texts.t('splitEqual', lang),
                  data: 'exp:split:equal',
                },
              ],
              [
                {
                  text: this.texts.t('splitManual', lang),
                  data: 'exp:split:manual',
                },
              ],
              this.navRow(lang),
            ],
          },
        );
        return;
      }

      case 'shares': {
        const employeeIds = flow.employeeIds ?? [];
        const index = (flow.shares ?? []).length;
        const employee = await this.prisma.db.employee.findUnique({
          where: { id: employeeIds[index] },
          select: { fullName: true },
        });

        await tx.sendMessage(
          update.chatId,
          head +
            this.texts.t('askShare', lang, {
              employee: employee?.fullName ?? '',
              index: index + 1,
              total: employeeIds.length,
            }),
          { inline: [this.navRow(lang)] },
        );
        return;
      }

      case 'amount': {
        await tx.sendMessage(
          update.chatId,
          head + this.texts.t('askAmount', lang),
          {
            inline: [this.navRow(lang)],
          },
        );
        return;
      }

      case 'date': {
        await tx.sendMessage(
          update.chatId,
          head + this.texts.t('askDate', lang),
          {
            inline: [
              [{ text: this.texts.t('dateToday', lang), data: 'exp:today' }],
              this.navRow(lang),
            ],
          },
        );
        return;
      }

      case 'comment': {
        const required = await this.commentRequired(flow);
        const rows: InlineButton[][] = [];
        if (!required) {
          rows.push([{ text: this.texts.t('skip', lang), data: 'exp:skip' }]);
        }
        rows.push(this.navRow(lang));

        await tx.sendMessage(
          update.chatId,
          head +
            this.texts.t(required ? 'commentRequired' : 'askComment', lang),
          { inline: rows },
        );
        return;
      }

      case 'receipt': {
        const required = await this.receiptRequired(flow);
        const rows: InlineButton[][] = [];
        if (flow.files?.length) {
          rows.push([
            { text: this.texts.t('next', lang), data: 'exp:receiptDone' },
          ]);
        } else if (!required) {
          rows.push([{ text: this.texts.t('skip', lang), data: 'exp:skip' }]);
        }
        rows.push(this.navRow(lang));

        await tx.sendMessage(
          update.chatId,
          head +
            this.texts.t(required ? 'receiptRequired' : 'askReceipt', lang),
          { inline: rows },
        );
        return;
      }

      case 'confirm': {
        await tx.sendMessage(
          update.chatId,
          head + (await this.summary(session, active, flow)),
          {
            inline: [
              [{ text: this.texts.t('confirmSend', lang), data: 'exp:send' }],
              [{ text: this.texts.t('confirmEdit', lang), data: 'exp:edit' }],
              [{ text: this.texts.t('cancel', lang), data: 'exp:cancel' }],
            ],
          },
        );
      }
    }
  }

  private async summary(
    session: BotSession,
    active: ActiveAccount,
    flow: ExpenseFlow,
  ): Promise<string> {
    const lang = toAppLanguage(session.language);
    const employees = await this.prisma.db.employee.findMany({
      where: { id: { in: flow.employeeIds ?? [] } },
      select: { fullName: true },
    });

    const lines = [
      this.texts.t('confirmHeader', lang),
      `🏢 ${active.branchName ?? ''}`,
      `📂 ${flow.categoryName ?? ''}`,
      `👤 ${employees.map((employee) => employee.fullName).join(', ')}`,
      `💰 ${formatAmount(flow.amount ?? '0', flow.currency ?? Currency.UZS, lang)}`,
      `📅 ${formatDate(flow.date ?? isoToday())}`,
    ];

    if (flow.comment) lines.push(`📝 ${flow.comment}`);
    if (flow.files?.length) lines.push(`📎 ${flow.files.length}`);

    return lines.join('\n');
  }

  private navRow(lang: AppLanguage): InlineButton[] {
    return [
      { text: this.texts.t('back', lang), data: 'exp:back' },
      { text: this.texts.t('cancel', lang), data: 'exp:cancel' },
    ];
  }

  private async commentRequired(flow: ExpenseFlow): Promise<boolean> {
    const category = await this.category(flow);
    return category?.commentRequired ?? false;
  }

  private async receiptRequired(flow: ExpenseFlow): Promise<boolean> {
    const category = await this.category(flow);
    return category?.receiptRequired ?? false;
  }

  private async category(flow: ExpenseFlow) {
    if (!flow.categoryId) return null;
    return this.prisma.db.category.findUnique({
      where: { id: flow.categoryId },
      select: { commentRequired: true, receiptRequired: true },
    });
  }
}
