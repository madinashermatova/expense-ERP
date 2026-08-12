import { Language } from '../../generated/prisma/enums';
import { NOTIFICATION_TYPES } from './notification-types';

interface Template {
  uz: string;
  ru: string;
}

/**
 * Bildirishnoma matnlari (TZ 3.11).
 *
 * Matn **serverda** tayyorlanadi: bir xil xabar Web badge ida ham, Telegram xabarida ham
 * ishlatiladi, ya'ni ikki mijozda takrorlamaslik kerak. To'liq i18n infratuzilmasi
 * (`nestjs-i18n`) S17 da keladi va shu jadval o'sha yerga ko'chadi.
 *
 * `{...}` o'rnini `payload` dagi maydonlar egallaydi; topilmagan kalit o'z joyida qoladi
 * (jim bo'sh satr qoldirsa xabar tushunarsiz bo'lardi).
 */
const TEMPLATES: Record<string, Template> = {
  [NOTIFICATION_TYPES.expenseCreated]: {
    uz: 'Yangi xarajat: {globalNumber} — {amount}',
    ru: 'Новый расход: {globalNumber} — {amount}',
  },
  [NOTIFICATION_TYPES.expenseDirectorApproved]: {
    uz: 'Direktor tasdiqladi, yakuniy tasdiq kutilmoqda: {globalNumber}',
    ru: 'Директор одобрил, ожидается финальное подтверждение: {globalNumber}',
  },
  [NOTIFICATION_TYPES.expenseFinalized]: {
    uz: 'Xarajat tasdiqlandi: {globalNumber}',
    ru: 'Расход подтверждён: {globalNumber}',
  },
  [NOTIFICATION_TYPES.expenseRejected]: {
    uz: 'Xarajat rad etildi: {globalNumber}. Sabab: {reason}',
    ru: 'Расход отклонён: {globalNumber}. Причина: {reason}',
  },
  [NOTIFICATION_TYPES.fixRequested]: {
    uz: 'Tuzatish so‘raldi: {globalNumber}. Sabab: {reason}',
    ru: 'Запрошено исправление: {globalNumber}. Причина: {reason}',
  },
  [NOTIFICATION_TYPES.editRequestSubmitted]: {
    uz: 'Tahrirlash murojaati: {globalNumber} — {description}',
    ru: 'Заявка на редактирование: {globalNumber} — {description}',
  },
  [NOTIFICATION_TYPES.refundSubmitted]: {
    uz: 'Qaytarish so‘rovi: {globalNumber} — {amount}',
    ru: 'Запрос на возврат: {globalNumber} — {amount}',
  },
  [NOTIFICATION_TYPES.refundResolved]: {
    uz: 'Qaytarish so‘rovi hal qilindi: {status}',
    ru: 'Запрос на возврат обработан: {status}',
  },
  [NOTIFICATION_TYPES.budgetThreshold]: {
    uz: 'Byudjet ogohlantirishi: {threshold}% ({period}) — limit {limit}, sarf {spent}',
    ru: 'Предупреждение по бюджету: {threshold}% ({period}) — лимит {limit}, расход {spent}',
  },
  [NOTIFICATION_TYPES.approvalReminder]: {
    uz: 'Eslatma: {globalNumber} arizasi {waitingHours} soatdan ortiq javobsiz',
    ru: 'Напоминание: заявка {globalNumber} без ответа более {waitingHours} ч',
  },
  [NOTIFICATION_TYPES.currencyRateFailed]: {
    uz: 'Valyuta kursi olinmadi ({currency}, {date}) — oxirgi ma‘lum kurs kuchda',
    ru: 'Не удалось получить курс ({currency}, {date}) — действует последний известный',
  },
  [NOTIFICATION_TYPES.dailyDigest]: {
    uz: 'Kunlik xulosa: {approved} tasdiqlangan, {pending} navbatda, jami {total}',
    ru: 'Сводка за день: одобрено {approved}, в очереди {pending}, всего {total}',
  },
};

/** Ichma-ich obyekt matnga aylanmaydi — `[object Object]` xabarni buzardi */
function stringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function fill(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    return stringify(payload[key]) ?? match;
  });
}

/** Bildirishnoma sarlavhasi — Web badge ida va Telegram xabarida bir xil */
export function renderNotification(
  type: string,
  payload: unknown,
  language: Language = Language.UZ,
): string {
  const template = TEMPLATES[type];
  const data =
    payload !== null && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {};

  // Noma'lum tur — turning o'zi ko'rsatiladi, xabar yo'qolib ketmasligi uchun
  if (!template) return type;

  return fill(language === Language.RU ? template.ru : template.uz, data);
}
