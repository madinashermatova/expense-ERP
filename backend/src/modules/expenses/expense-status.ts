import { ExpenseStatus, Role } from '../../generated/prisma/enums';

/**
 * TZ 3.7 — ikki bosqichli tasdiqlash oqimi.
 *
 * ```
 * DRAFT ──submit──> DIRECTOR_PENDING ──approve──> ADMIN_PENDING ──approve──> APPROVED
 *                          │                            │
 *                          ├──reject──> REJECTED <───────┤
 *                          ├──request-fix──> NEEDS_FIX <─┤
 *                          └──cancel──> CANCELLED        │
 *                                   NEEDS_FIX ──submit──>┘ (oqim 1-bosqichdan)
 * ```
 *
 * Jadval ataylab bitta joyda: yangi status yoki amal qo'shilganda ruxsat etilgan
 * o'tishlar ro'yxati ham, uni kim bajara olishi ham shu yerda ko'rinadi.
 */
export type ExpenseAction =
  'submit' | 'approve' | 'reject' | 'request-fix' | 'cancel';

export interface Transition {
  from: ExpenseStatus;
  action: ExpenseAction;
  to: ExpenseStatus;
  /** Amalni bajara oladigan rollar */
  roles: readonly Role[];
  /** Faqat xarajatni kiritgan shaxs bajara oladi */
  creatorOnly?: boolean;
  /** Sabab matni majburiy (≥ 10 belgi) */
  reasonRequired?: boolean;
}

const D = Role.DIRECTOR;
const A = Role.ADMIN;

export const TRANSITIONS: readonly Transition[] = [
  // Qoralama va tuzatishdan keyin qayta yuborish — oqim har doim 1-bosqichdan boshlanadi
  {
    from: ExpenseStatus.DRAFT,
    action: 'submit',
    to: ExpenseStatus.DIRECTOR_PENDING,
    roles: [A, D],
  },
  {
    from: ExpenseStatus.NEEDS_FIX,
    action: 'submit',
    to: ExpenseStatus.DIRECTOR_PENDING,
    roles: [A, D],
  },

  // 1-bosqich: filial direktori (bosh admin ham bajara oladi)
  {
    from: ExpenseStatus.DIRECTOR_PENDING,
    action: 'approve',
    to: ExpenseStatus.ADMIN_PENDING,
    roles: [D, A],
  },
  {
    from: ExpenseStatus.DIRECTOR_PENDING,
    action: 'reject',
    to: ExpenseStatus.REJECTED,
    roles: [D, A],
    reasonRequired: true,
  },
  {
    from: ExpenseStatus.DIRECTOR_PENDING,
    action: 'request-fix',
    to: ExpenseStatus.NEEDS_FIX,
    roles: [D, A],
    reasonRequired: true,
  },

  // 2-bosqich: faqat bosh admin — direktor bu yerda 403 oladi
  {
    from: ExpenseStatus.ADMIN_PENDING,
    action: 'approve',
    to: ExpenseStatus.APPROVED,
    roles: [A],
  },
  {
    from: ExpenseStatus.ADMIN_PENDING,
    action: 'reject',
    to: ExpenseStatus.REJECTED,
    roles: [A],
    reasonRequired: true,
  },
  {
    from: ExpenseStatus.ADMIN_PENDING,
    action: 'request-fix',
    to: ExpenseStatus.NEEDS_FIX,
    roles: [A],
    reasonRequired: true,
  },

  // Bekor qilish — faqat kiritgan shaxs, faqat hali qaror chiqmagan holatda
  {
    from: ExpenseStatus.DRAFT,
    action: 'cancel',
    to: ExpenseStatus.CANCELLED,
    roles: [A, D],
    creatorOnly: true,
  },
  {
    from: ExpenseStatus.DIRECTOR_PENDING,
    action: 'cancel',
    to: ExpenseStatus.CANCELLED,
    roles: [A, D],
    creatorOnly: true,
  },
  {
    from: ExpenseStatus.NEEDS_FIX,
    action: 'cancel',
    to: ExpenseStatus.CANCELLED,
    roles: [A, D],
    creatorOnly: true,
  },
];

export function findTransition(
  from: ExpenseStatus,
  action: ExpenseAction,
): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.action === action);
}

/**
 * Sarf va hisobotlarga kiradigan statuslar: ikki bosqichdan o'tgan xarajatlar.
 *
 * Qisman yoki to'liq qaytarilgan yozuv ham shu ro'yxatda — uning **effektiv** summasi
 * hisoblanadi (`amount − refundedAmount`), TZ 3.9, 3.10, 3.13. Ro'yxat bitta joyda:
 * byudjet, tahrirlash va hisobotlar aynan shunga tayanadi.
 */
export const SPEND_COUNTED_STATUSES: readonly ExpenseStatus[] = [
  ExpenseStatus.APPROVED,
  ExpenseStatus.PARTIALLY_REFUNDED,
  ExpenseStatus.REFUNDED,
];

/** Tasdiqlash navbatida turgan, ya'ni hali yakuniy qaror chiqmagan statuslar */
export const PENDING_STATUSES: readonly ExpenseStatus[] = [
  ExpenseStatus.DIRECTOR_PENDING,
  ExpenseStatus.ADMIN_PENDING,
];

/** Sabab matnining eng kam uzunligi (TZ 3.7) */
export const MIN_REASON_LENGTH = 10;
