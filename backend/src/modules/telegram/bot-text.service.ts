import { Injectable } from '@nestjs/common';
import { AppLanguage, SUPPORTED_LANGUAGES } from '../../common/i18n/languages';
import { TranslationService } from '../../common/i18n/translation.service';
import { ExpenseStatus, Role } from '../../generated/prisma/enums';

/**
 * Bot tugmalarining id lari. Matnlar `src/i18n/{uz,ru}/bot.json` da (`buttons` bo'limi),
 * bu ro'yxat esa menyu tuzilishi uchun kerak — id kod ichida, matn tarjimada.
 */
export const BUTTON_IDS = [
  'login',
  'help',
  'addExpense',
  'myExpenses',
  'refund',
  'editRequest',
  'myStats',
  'switchAccount',
  'settings',
  'logout',
  'pendingApprovals',
  'finalApprovals',
  'refundRequests',
  'editRequests',
  'branchExpenses',
  'branchStats',
  'companyStats',
  'employees',
  'webErp',
] as const;

export type ButtonId = (typeof BUTTON_IDS)[number];

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

/**
 * Bot matnlari (TZ 3.12, 4.3).
 *
 * Til **sessiyadan** keladi, so'rov sarlavhasidan emas: Telegram da `Accept-Language`
 * yo'q, foydalanuvchi tilni bot ichida tanlaydi. Shuning uchun har metod `lang` ni
 * aniq argument sifatida oladi.
 *
 * Tugma matni ikki yo'nalishda kerak: id → matn (klaviatura chizish) va matn → id
 * (foydalanuvchi bosgan tugmani tanish). Ikkinchisi **barcha tillarda** qidiradi:
 * til almashtirilganda ekranda eski klaviatura qolishi mumkin, o'sha tugma ham
 * ishlashi kerak.
 */
@Injectable()
export class BotTextService {
  constructor(private readonly translations: TranslationService) {}

  t(
    key: string,
    lang: AppLanguage,
    args: Record<string, string | number> = {},
  ): string {
    return this.translations.translateOr(`bot.${key}`, key, { lang, args });
  }

  button(id: ButtonId, lang: AppLanguage): string {
    return this.t(`buttons.${id}`, lang);
  }

  roleName(role: Role, lang: AppLanguage): string {
    return this.t(`roles.${role}`, lang);
  }

  statusName(status: ExpenseStatus, lang: AppLanguage): string {
    return this.t(`statuses.${status}`, lang);
  }

  /** Foydalanuvchi bosgan tugma matnidan id ni topadi (barcha tillarda) */
  buttonIdFromLabel(label: string): ButtonId | null {
    const needle = label.trim();

    for (const id of BUTTON_IDS) {
      for (const lang of SUPPORTED_LANGUAGES) {
        if (this.button(id, lang) === needle) return id;
      }
    }

    return null;
  }

  /**
   * Rolga mos asosiy menyu.
   *
   * Oxirgi qatorga hisob tugmasi qo'shiladi: bir nechta hisob bog'langan bo'lsa
   * "Hisobni almashtirish", aks holda "Chiqish" (TZ 3.12.2 — bitta hisobda
   * almashtirish tugmasi ko'rinmaydi).
   */
  mainMenu(role: Role, lang: AppLanguage, linkedAccounts: number): string[][] {
    const rows = this.menuFor(role).map((row) =>
      row.map((id) => this.button(id, lang)),
    );
    rows.push([
      this.button(linkedAccounts > 1 ? 'switchAccount' : 'logout', lang),
    ]);
    return rows;
  }

  guestMenu(lang: AppLanguage): string[][] {
    return GUEST_MENU.map((row) => row.map((id) => this.button(id, lang)));
  }

  /** Til tanlash inline klaviaturasi — bayroqlar tarjimasiz, matn tarjimada */
  languageKeyboard(): { text: string; data: string }[][] {
    return [
      [
        { text: this.t('languageUz', 'uz'), data: 'lang:uz' },
        { text: this.t('languageRu', 'ru'), data: 'lang:ru' },
      ],
    ];
  }

  /** Hisob inline tugmalari (menyu tugmalari emas — xabar ostida chiqadi) */
  addAccountLabel(lang: AppLanguage): string {
    return this.t('addAccountButton', lang);
  }

  logoutLabel(lang: AppLanguage): string {
    return this.t('logoutButton', lang);
  }

  logoutAllLabel(lang: AppLanguage): string {
    return this.t('logoutAllButton', lang);
  }

  private menuFor(role: Role): ButtonId[][] {
    switch (role) {
      case Role.WORKER:
        return WORKER_MENU;
      case Role.DIRECTOR:
        return DIRECTOR_MENU;
      default:
        return ADMIN_MENU;
    }
  }
}
