import { Role } from '../../generated/prisma/enums';
import { ButtonId, buttonLabel, Lang } from './bot-texts';

/** Kirmagan foydalanuvchi faqat shu ikkitasini ko'radi (TZ 3.12.1) */
const GUEST_MENU: ButtonId[][] = [['login', 'help']];

const WORKER_MENU: ButtonId[][] = [
  ['addExpense'],
  ['myExpenses', 'myStats'],
  ['refund', 'editRequest'],
  ['settings', 'help'],
];

const DIRECTOR_MENU: ButtonId[][] = [
  ['pendingApprovals'],
  ['refundRequests', 'editRequests'],
  ['branchExpenses', 'branchStats'],
  ['employees', 'addExpense'],
  ['webErp', 'settings'],
  ['help'],
];

const ADMIN_MENU: ButtonId[][] = [
  ['finalApprovals'],
  ['pendingApprovals'],
  ['refundRequests', 'editRequests'],
  ['branchExpenses', 'companyStats'],
  ['employees', 'addExpense'],
  ['webErp', 'settings'],
  ['help'],
];

function menuFor(role: Role): ButtonId[][] {
  switch (role) {
    case Role.WORKER:
      return WORKER_MENU;
    case Role.DIRECTOR:
      return DIRECTOR_MENU;
    default:
      return ADMIN_MENU;
  }
}

/**
 * Rolga mos asosiy menyu.
 *
 * Oxirgi qatorga hisob tugmasi qo'shiladi: bir nechta hisob bog'langan bo'lsa
 * "Hisobni almashtirish", aks holda "Chiqish" (TZ 3.12.2 — bitta hisobda
 * almashtirish tugmasi ko'rinmaydi).
 */
export function mainMenu(
  role: Role,
  lang: Lang,
  linkedAccounts: number,
): string[][] {
  const rows = menuFor(role).map((row) =>
    row.map((id) => buttonLabel(id, lang)),
  );
  rows.push([
    buttonLabel(linkedAccounts > 1 ? 'switchAccount' : 'logout', lang),
  ]);
  return rows;
}

export function guestMenu(lang: Lang): string[][] {
  return GUEST_MENU.map((row) => row.map((id) => buttonLabel(id, lang)));
}

/**
 * Hisoblar bilan ishlash inline tugmalari. Ular menyu tugmalari (`BUTTONS`) emas:
 * xabar ostida chiqadi va matn sifatida qaytmaydi, shuning uchun alohida turadi.
 */
export function addAccountLabel(lang: Lang): string {
  return lang === 'ru' ? '➕ Добавить аккаунт' : "➕ Boshqa hisob qo'shish";
}

export function logoutLabel(lang: Lang): string {
  return lang === 'ru' ? '🚪 Выход' : '🚪 Chiqish';
}

export function logoutAllLabel(lang: Lang): string {
  return lang === 'ru' ? '🚪 Выйти из всех' : '🚪 Barcha hisoblardan chiqish';
}

export const LANGUAGE_KEYBOARD = [
  [
    { text: "🇺🇿 O'zbekcha", data: 'lang:uz' },
    { text: '🇷🇺 Русский', data: 'lang:ru' },
  ],
];
