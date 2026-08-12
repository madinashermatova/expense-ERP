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

/**
 * Qaror sababi (rad etish / tuzatish so'rash / qaytarishni rad etish).
 * Sabab majburiy (TZ 3.7), shuning uchun matn kelishini kutish alohida qadam.
 */
export interface DecisionFlow {
  name: 'decision';
  step: 'reason';
  kind: 'expense' | 'refund' | 'edit';
  targetId: string;
  action: 'reject' | 'fix';
  /** Optimistik qulf uchun — kartochka ko'rsatilgan paytdagi versiya */
  version?: number;
  /** Kartochka qaysi navbatdan ochilgan — "allaqachon qayta ishlangan" ni aniqlash uchun */
  stage?: 'director' | 'admin';
}

/** Pulni qaytarish so'rovi (TZ 3.9, bot tomoni) */
export interface RefundFlow {
  name: 'refund';
  step: 'expense' | 'amount' | 'reason' | 'proof' | 'confirm';
  page?: number;
  expenseId?: string;
  expenseNumber?: string;
  /** Qaytarish mumkin bo'lgan eng ko'p summa (qaytarilgani chegirilgan) */
  maxAmount?: string;
  amount?: string;
  reason?: string;
  files?: PendingFile[];
}

/** Tahrirlash murojaati (TZ 3.8, bot tomoni) */
export interface EditRequestFlow {
  name: 'editRequest';
  step: 'expense' | 'description';
  page?: number;
  expenseId?: string;
  expenseNumber?: string;
}

export type FlowState =
  LoginFlow | ExpenseFlow | DecisionFlow | RefundFlow | EditRequestFlow;

export function isFlow<N extends FlowState['name']>(
  flow: FlowState | null,
  name: N,
): flow is Extract<FlowState, { name: N }> {
  return flow !== null && flow.name === name;
}
