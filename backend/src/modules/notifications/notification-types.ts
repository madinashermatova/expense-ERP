/**
 * Bildirishnoma turlari (TZ 3.11).
 *
 * Servisdan alohida fayl: matn shabloni (`notification-messages.ts`) va navbat
 * processori ham shu ro'yxatga tayanadi, servis esa ularni import qiladi —
 * bir faylda saqlansa aylanma import chiqardi.
 */
export const NOTIFICATION_TYPES = {
  currencyRateFailed: 'CURRENCY_RATE_FAILED',
  expenseCreated: 'EXPENSE_CREATED',
  expenseDirectorApproved: 'EXPENSE_DIRECTOR_APPROVED',
  expenseFinalized: 'EXPENSE_FINALIZED',
  expenseRejected: 'EXPENSE_REJECTED',
  fixRequested: 'FIX_REQUESTED',
  editRequestSubmitted: 'EDIT_REQUEST_SUBMITTED',
  refundSubmitted: 'REFUND_SUBMITTED',
  refundResolved: 'REFUND_RESOLVED',
  budgetThreshold: 'BUDGET_THRESHOLD',
  approvalReminder: 'APPROVAL_REMINDER',
  dailyDigest: 'DAILY_DIGEST',
  exportReady: 'EXPORT_READY',
  exportFailed: 'EXPORT_FAILED',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
