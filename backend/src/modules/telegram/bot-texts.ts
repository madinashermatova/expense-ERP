import { Language, Role } from '../../generated/prisma/enums';

export type Lang = 'uz' | 'ru';

export function langOf(language: Language): Lang {
  return language === Language.RU ? 'ru' : 'uz';
}

export function languageOf(lang: Lang): Language {
  return lang === 'ru' ? Language.RU : Language.UZ;
}

interface Phrase {
  uz: string;
  ru: string;
}

/**
 * Bot matnlari (TZ 3.12).
 *
 * Bildirishnomalar bilan bir xil yondashuv (`notification-messages.ts`): matn kod ichida
 * uz/ru juftligi sifatida turadi va S17 da `nestjs-i18n` fayllariga ko'chiriladi. Bot
 * uchun til **so'rov sarlavhasidan emas**, sessiyadan olinadi — Telegram da `Accept-Language`
 * yo'q, foydalanuvchi tilni o'zi tanlaydi.
 */
const TEXTS = {
  chooseLanguage: {
    uz: 'Tilni tanlang / Выберите язык',
    ru: 'Tilni tanlang / Выберите язык',
  },
  guestWelcome: {
    uz: 'Xush kelibsiz! Davom etish uchun tizimga kiring.',
    ru: 'Добро пожаловать! Для продолжения войдите в систему.',
  },
  askLogin: {
    uz: 'Login (email yoki foydalanuvchi nomi) ni yuboring:',
    ru: 'Отправьте логин (email или имя пользователя):',
  },
  askPassword: {
    uz: "Parolni yuboring. Xabar xavfsizlik uchun darhol o'chiriladi.",
    ru: 'Отправьте пароль. Сообщение будет сразу удалено в целях безопасности.',
  },
  invalidCredentials: {
    uz: "Login yoki parol noto'g'ri. Qaytadan urinib ko'ring.",
    ru: 'Логин или пароль неверны. Попробуйте снова.',
  },
  loginLocked: {
    uz: 'Juda ko‘p urinish. {minutes} daqiqadan keyin qayta urinib ko‘ring.',
    ru: 'Слишком много попыток. Повторите через {minutes} мин.',
  },
  loginPasswordHint: {
    uz: 'Parolni eslay olmasangiz — administratoringizga murojaat qiling.',
    ru: 'Если не помните пароль — обратитесь к своему администратору.',
  },
  loginSuccess: {
    uz: 'Salom, {fullName}!\n🏢 {company}\n👤 Rol: {role}',
    ru: 'Здравствуйте, {fullName}!\n🏢 {company}\n👤 Роль: {role}',
  },
  chooseCompany: {
    uz: 'Bu login bir nechta kompaniyada mavjud — kompaniyani tanlang:',
    ru: 'Этот логин есть в нескольких компаниях — выберите компанию:',
  },
  choiceExpired: {
    uz: 'Tanlov muddati tugadi — qaytadan kiring.',
    ru: 'Время выбора истекло — войдите снова.',
  },
  accountInactive: {
    uz: 'Hisob faol emas — administratoringizga murojaat qiling.',
    ru: 'Аккаунт неактивен — обратитесь к администратору.',
  },
  companySuspended: {
    uz: "Kompaniya hisobi to'xtatilgan.",
    ru: 'Аккаунт компании приостановлен.',
  },
  foreignCompany: {
    uz: 'Bu bot faqat {company} xodimlari uchun.',
    ru: 'Этот бот только для сотрудников {company}.',
  },
  alreadyLinked: {
    uz: "Bu hisob allaqachon bog'langan — unga o'tildi.",
    ru: 'Этот аккаунт уже привязан — переключились на него.',
  },
  notLoggedIn: {
    uz: 'Buning uchun tizimga kirish kerak.',
    ru: 'Для этого нужно войти в систему.',
  },
  sessionExpired: {
    uz: 'Sessiya muddati tugadi — qaytadan kiring.',
    ru: 'Сессия истекла — войдите снова.',
  },
  accountsHeader: {
    uz: "Bog'langan hisoblar:",
    ru: 'Привязанные аккаунты:',
  },
  accountSwitched: {
    uz: 'Faol hisob: {company} — {fullName} ({role})',
    ru: 'Активный аккаунт: {company} — {fullName} ({role})',
  },
  flowCancelledBySwitch: {
    uz: '⚠️ Tugallanmagan amal bekor qilindi (hisob almashtirildi).',
    ru: '⚠️ Незавершённое действие отменено (аккаунт переключён).',
  },
  loggedOut: {
    uz: 'Hisobdan chiqdingiz.',
    ru: 'Вы вышли из аккаунта.',
  },
  loggedOutAll: {
    uz: 'Barcha hisoblardan chiqdingiz.',
    ru: 'Вы вышли из всех аккаунтов.',
  },
  languageChanged: {
    uz: "Til o'zgartirildi.",
    ru: 'Язык изменён.',
  },
  settingsHeader: {
    uz: 'Sozlamalar',
    ru: 'Настройки',
  },
  profile: {
    uz: '👤 {fullName}\n🏢 {company}\n📂 Rol: {role}\n🏬 Filial: {branch}',
    ru: '👤 {fullName}\n🏢 {company}\n📂 Роль: {role}\n🏬 Филиал: {branch}',
  },
  help: {
    uz: [
      'Bot orqali xarajat kiritish, tasdiqlash va hisobot ko‘rish mumkin.',
      '',
      '/start — boshlash',
      '/menu — asosiy menyu',
      '/cancel — joriy amalni bekor qilish',
      '',
      "Parol yoki hisob bilan muammo bo'lsa administratoringizga murojaat qiling.",
    ].join('\n'),
    ru: [
      'Через бота можно вносить расходы, согласовывать их и смотреть отчёты.',
      '',
      '/start — начать',
      '/menu — главное меню',
      '/cancel — отменить текущее действие',
      '',
      'При проблемах с паролем или аккаунтом обратитесь к администратору.',
    ].join('\n'),
  },
  menuHeader: {
    uz: 'Asosiy menyu',
    ru: 'Главное меню',
  },
  cancelled: {
    uz: 'Bekor qilindi.',
    ru: 'Отменено.',
  },
  nothingToCancel: {
    uz: 'Bekor qiladigan amal yo‘q.',
    ru: 'Нечего отменять.',
  },
  unknownCommand: {
    uz: 'Menyudan tanlang.',
    ru: 'Выберите пункт меню.',
  },
  notAvailableYet: {
    uz: 'Bu bo‘lim tez orada ishga tushadi.',
    ru: 'Этот раздел скоро будет доступен.',
  },
  webLink: {
    uz: '🌐 Web ERP: {url}',
    ru: '🌐 Web ERP: {url}',
  },
  serverError: {
    uz: 'Xatolik yuz berdi. Keyinroq urinib ko‘ring.',
    ru: 'Произошла ошибка. Попробуйте позже.',
  },
} as const satisfies Record<string, Phrase>;

export type TextKey = keyof typeof TEXTS;

const ROLE_NAMES: Record<Role, Phrase> = {
  PLATFORM_OWNER: { uz: 'Platforma egasi', ru: 'Владелец платформы' },
  ADMIN: { uz: 'Bosh admin', ru: 'Главный админ' },
  DIRECTOR: { uz: 'Filial direktori', ru: 'Директор филиала' },
  WORKER: { uz: 'Ishchi', ru: 'Работник' },
};

export function roleName(role: Role, lang: Lang): string {
  return ROLE_NAMES[role][lang];
}

/**
 * Bot tugmalari. Har tugma **id** bilan aniqlanadi, matn esa tilga bog'liq.
 * Kelgan matn ikkala tilda ham qidiriladi: foydalanuvchi tilni almashtirganda
 * ekranda eski klaviatura qolib ketishi mumkin, o'sha tugma ham ishlashi kerak.
 */
export const BUTTONS = {
  login: { uz: '🔐 Kirish', ru: '🔐 Вход' },
  help: { uz: '❓ Yordam', ru: '❓ Помощь' },
  addExpense: { uz: '➕ Xarajat qo‘shish', ru: '➕ Добавить расход' },
  myExpenses: { uz: '📋 Mening xarajatlarim', ru: '📋 Мои расходы' },
  refund: { uz: '↩️ Pulni qaytarish', ru: '↩️ Возврат денег' },
  editRequest: { uz: '✏️ Tahrirlash so‘rovi', ru: '✏️ Заявка на правку' },
  myStats: { uz: '📊 Statistikam', ru: '📊 Моя статистика' },
  switchAccount: { uz: '🔄 Hisobni almashtirish', ru: '🔄 Сменить аккаунт' },
  settings: { uz: '⚙️ Sozlamalar', ru: '⚙️ Настройки' },
  logout: { uz: '🚪 Chiqish', ru: '🚪 Выход' },
  pendingApprovals: {
    uz: '🔔 Tasdiqlash kutilmoqda',
    ru: '🔔 Ожидают согласования',
  },
  finalApprovals: {
    uz: '✅ Yakuniy tasdiqlash',
    ru: '✅ Финальное согласование',
  },
  refundRequests: {
    uz: '↩️ Qaytarish so‘rovlari',
    ru: '↩️ Запросы на возврат',
  },
  editRequests: { uz: '✏️ Tahrirlash so‘rovlari', ru: '✏️ Заявки на правку' },
  branchExpenses: { uz: '📋 Filial xarajatlari', ru: '📋 Расходы филиала' },
  branchStats: { uz: '📊 Filial statistikasi', ru: '📊 Статистика филиала' },
  companyStats: { uz: '📊 Umumiy statistika', ru: '📊 Общая статистика' },
  employees: { uz: '👥 Xodimlar', ru: '👥 Сотрудники' },
  webErp: { uz: '🌐 Web ERP', ru: '🌐 Web ERP' },
} as const satisfies Record<string, Phrase>;

export type ButtonId = keyof typeof BUTTONS;

export function buttonLabel(id: ButtonId, lang: Lang): string {
  return BUTTONS[id][lang];
}

/** Foydalanuvchi bosgan tugma matnidan id ni topadi (ikkala tilda ham) */
export function buttonIdFromLabel(label: string): ButtonId | null {
  const needle = label.trim();
  for (const [id, phrase] of Object.entries(BUTTONS)) {
    if (phrase.uz === needle || phrase.ru === needle) {
      return id as ButtonId;
    }
  }
  return null;
}

export function t(
  key: TextKey,
  lang: Lang,
  vars: Record<string, string | number> = {},
): string {
  const template = TEXTS[key][lang];
  // Topilmagan kalit o'z joyida qoladi — jim bo'sh satr xabarni tushunarsiz qilardi
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
