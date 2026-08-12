import { Currency } from '../../generated/prisma/enums';

/**
 * Sahna holati (TZ 3.12.3 — "bot sessiya holati Redis da saqlanadi; bot qayta
 * ishga tushsa oqim yo'qolmaydi").
 *
 * Holat **diskriminatsiyalangan union**: har oqim o'z qadamlari va o'z ma'lumotini
 * saqlaydi, ya'ni bir oqimning maydoni boshqasiga tasodifan o'tib ketmaydi.
 */
export interface LoginFlow {
  name: 'login';
  step: 'login' | 'password' | 'company';
  login?: string;
  /** "➕ Boshqa hisob qo'shish" dan kelgan oqim — muvaffaqiyatdan keyin xabar boshqa */
  addAccount?: boolean;
  /**
   * Bir login bir nechta kompaniyada topilganda tanlash uchun nomzodlar.
   * **Parol saqlanmaydi** — u oldingi qadamda tekshirilgan, `verifiedAt` esa shu
   * tekshiruv qancha vaqt oldin bo'lganini bildiradi (eskirsa oqim boshdan boshlanadi).
   */
  companyOptions?: { userId: string; companyName: string }[];
  verifiedAt?: string;
}

export const EXPENSE_STEPS = [
  'category',
  'subcategory',
  'target',
  'employees',
  'split',
  'shares',
  'amount',
  'date',
  'comment',
  'receipt',
  'confirm',
] as const;

export type ExpenseStep = (typeof EXPENSE_STEPS)[number];

/** Botga yuklangan fayl: mazmun xarajat yaratilgandan keyin ko'chiriladi */
export interface PendingFile {
  fileId: string;
  name: string;
}

/** Xarajat qo'shish sahnasi (TZ 3.12.3 — 9 qadam, har qadamda ⬅️ / ❌) */
export interface ExpenseFlow {
  name: 'expense';
  step: ExpenseStep;
  /** "Orqaga" uchun yurilgan yo'l — qadamlar shartli (masalan guruh bo'lmasa taqsimlash yo'q) */
  history: ExpenseStep[];
  parentCategoryId?: string;
  categoryId?: string;
  categoryName?: string;
  target?: 'self' | 'other' | 'group';
  employeeIds?: string[];
  /** Xodimlar ro'yxati sahifasi */
  page?: number;
  split?: 'equal' | 'manual';
  shares?: { employeeId: string; amount: string }[];
  amount?: string;
  currency?: Currency;
  date?: string;
  comment?: string;
  files?: PendingFile[];
}

export type FlowState = LoginFlow | ExpenseFlow;

export function isFlow<N extends FlowState['name']>(
  flow: FlowState | null,
  name: N,
): flow is Extract<FlowState, { name: N }> {
  return flow !== null && flow.name === name;
}
