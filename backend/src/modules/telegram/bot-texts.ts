import { ExpenseStatus, Language, Role } from '../../generated/prisma/enums';

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
  askCategory: {
    uz: '📂 Kategoriyani tanlang:',
    ru: '📂 Выберите категорию:',
  },
  askSubcategory: {
    uz: '📂 {category} → quyi kategoriyani tanlang:',
    ru: '📂 {category} → выберите подкатегорию:',
  },
  noCategories: {
    uz: 'Faol kategoriya yo‘q — administratoringizga murojaat qiling.',
    ru: 'Нет активных категорий — обратитесь к администратору.',
  },
  askTarget: {
    uz: '👤 Xarajat kim uchun?',
    ru: '👤 Для кого расход?',
  },
  targetSelf: { uz: "🙋 O'zim uchun", ru: '🙋 Для себя' },
  targetOther: { uz: '👤 Boshqa xodim', ru: '👤 Другой сотрудник' },
  targetGroup: { uz: '👥 Guruh', ru: '👥 Группа' },
  askEmployee: {
    uz: '👤 Xodimni tanlang:',
    ru: '👤 Выберите сотрудника:',
  },
  askEmployees: {
    uz: '👥 Xodimlarni belgilang (tanlangan: {count}), so‘ng "Davom etish":',
    ru: '👥 Отметьте сотрудников (выбрано: {count}), затем «Продолжить»:',
  },
  noEmployees: {
    uz: 'Filialda faol xodim topilmadi.',
    ru: 'В филиале нет активных сотрудников.',
  },
  selectAtLeastOne: {
    uz: 'Kamida bitta xodimni belgilang.',
    ru: 'Отметьте хотя бы одного сотрудника.',
  },
  askSplit: {
    uz: '➗ Summani qanday taqsimlaymiz?',
    ru: '➗ Как распределим сумму?',
  },
  splitEqual: { uz: '➗ Teng bo‘lish', ru: '➗ Разделить равно' },
  splitManual: { uz: '✍️ Qo‘lda', ru: '✍️ Вручную' },
  askShare: {
    uz: '✍️ {employee} uchun summa ({index}/{total}):',
    ru: '✍️ Сумма для {employee} ({index}/{total}):',
  },
  askAmount: {
    uz: '💰 Summani yuboring (masalan `150000` yoki `100 USD`):',
    ru: '💰 Отправьте сумму (например `150000` или `100 USD`):',
  },
  amountInvalid: {
    uz: 'Summa noto‘g‘ri. Musbat son yuboring, masalan 150000.',
    ru: 'Неверная сумма. Отправьте положительное число, например 150000.',
  },
  sharesSumMismatch: {
    uz: 'Ulushlar yig‘indisi {sum}, umumiy summa {total} — mos kelmadi. Qaytadan kiritamiz.',
    ru: 'Сумма долей {sum}, а общая {total} — не совпадает. Введём заново.',
  },
  askDate: {
    uz: '📅 Sanani tanlang yoki `KK.OO.YYYY` shaklida yuboring:',
    ru: '📅 Выберите дату или отправьте в виде `ДД.ММ.ГГГГ`:',
  },
  dateToday: { uz: '📅 Bugun', ru: '📅 Сегодня' },
  dateInvalid: {
    uz: 'Sana noto‘g‘ri. Masalan: 06.08.2026.',
    ru: 'Неверная дата. Например: 06.08.2026.',
  },
  askComment: {
    uz: '📝 Izoh yuboring:',
    ru: '📝 Отправьте комментарий:',
  },
  commentRequired: {
    uz: '📝 Bu kategoriya uchun izoh majburiy — matn yuboring:',
    ru: '📝 Для этой категории комментарий обязателен — отправьте текст:',
  },
  askReceipt: {
    uz: '📎 Chek/isbot yuboring (rasm yoki PDF):',
    ru: '📎 Отправьте чек/подтверждение (фото или PDF):',
  },
  receiptRequired: {
    uz: '📎 Bu kategoriya uchun chek majburiy — rasm yoki PDF yuboring:',
    ru: '📎 Для этой категории чек обязателен — отправьте фото или PDF:',
  },
  receiptAdded: {
    uz: '📎 Qabul qilindi (jami {count}). Yana yuborishingiz yoki davom etishingiz mumkin.',
    ru: '📎 Принято (всего {count}). Можно отправить ещё или продолжить.',
  },
  confirmHeader: {
    uz: 'Tekshirib chiqing:',
    ru: 'Проверьте данные:',
  },
  confirmSend: { uz: '✅ Yuborish', ru: '✅ Отправить' },
  confirmEdit: { uz: '✏️ Tahrirlash', ru: '✏️ Изменить' },
  back: { uz: '⬅️ Orqaga', ru: '⬅️ Назад' },
  cancel: { uz: '❌ Bekor qilish', ru: '❌ Отмена' },
  skip: { uz: '⏭ O‘tkazib yuborish', ru: '⏭ Пропустить' },
  next: { uz: '➡️ Davom etish', ru: '➡️ Продолжить' },
  expenseSubmitted: {
    uz: 'Arizangiz {number} direktorga yuborildi.',
    ru: 'Ваша заявка {number} отправлена директору.',
  },
  expenseSubmittedAdmin: {
    uz: 'Arizangiz {number} yakuniy tasdiqqa yuborildi.',
    ru: 'Ваша заявка {number} отправлена на финальное подтверждение.',
  },
  expenseDraft: {
    uz: 'Xarajat {number} qoralama sifatida saqlandi — chek biriktirilgach yuboriladi.',
    ru: 'Расход {number} сохранён как черновик — будет отправлен после чека.',
  },
  duplicateWarning: {
    uz: '⚠️ Yaqinda shunga o‘xshash xarajat kiritilgan: {number}',
    ru: '⚠️ Недавно уже вносили похожий расход: {number}',
  },
  budgetLimit: { uz: 'limit', ru: 'лимит' },
  budgetWarningLine: {
    uz: '⚠️ Byudjet: {message}',
    ru: '⚠️ Бюджет: {message}',
  },
  branchMissing: {
    uz: 'Hisobingizga filial biriktirilmagan — administratoringizga murojaat qiling.',
    ru: 'К вашему аккаунту не привязан филиал — обратитесь к администратору.',
  },
  employeeMissing: {
    uz: 'Hisobingiz xodim kartochkasiga bog‘lanmagan — administratoringizga murojaat qiling.',
    ru: 'Ваш аккаунт не связан с карточкой сотрудника — обратитесь к администратору.',
  },
  fileFailed: {
    uz: 'Fayl yuklanmadi, lekin xarajat saqlandi: {number}. Chekni web orqali biriktiring.',
    ru: 'Файл не загрузился, но расход сохранён: {number}. Прикрепите чек через веб.',
  },
  approvalsEmpty: {
    uz: 'Tasdiqlash kutayotgan ariza yo‘q.',
    ru: 'Нет заявок, ожидающих согласования.',
  },
  approvalCard: {
    uz: '🆕 Xarajat {number} ({index}/{total})\n🏢 Filial: {branch}\n👤 Xodim: {employees}\n📂 Kategoriya: {category}\n💰 Summa: {amount}\n📅 Sana: {date}',
    ru: '🆕 Расход {number} ({index}/{total})\n🏢 Филиал: {branch}\n👤 Сотрудник: {employees}\n📂 Категория: {category}\n💰 Сумма: {amount}\n📅 Дата: {date}',
  },
  approvalComment: {
    uz: '📝 Izoh: {comment}',
    ru: '📝 Комментарий: {comment}',
  },
  approvalFiles: {
    uz: '📎 Chek: {count} ta',
    ru: '📎 Чек: {count} шт.',
  },
  approvalCompany: {
    uz: '🏢 Kompaniya: {company}',
    ru: '🏢 Компания: {company}',
  },
  approve: { uz: '✅ Tasdiqlash', ru: '✅ Одобрить' },
  rejectAction: { uz: '❌ Rad etish', ru: '❌ Отклонить' },
  requestFix: { uz: '✏️ Tuzatish so‘rash', ru: '✏️ Запросить правку' },
  askReason: {
    uz: 'Sababni yozing (kamida {min} belgi):',
    ru: 'Напишите причину (минимум {min} символов):',
  },
  reasonTooShort: {
    uz: 'Sabab kamida {min} belgidan iborat bo‘lishi kerak.',
    ru: 'Причина должна быть не короче {min} символов.',
  },
  approvedDone: {
    uz: '✅ {number} tasdiqlandi.',
    ru: '✅ {number} одобрен.',
  },
  rejectedDone: {
    uz: '❌ {number} rad etildi.',
    ru: '❌ {number} отклонён.',
  },
  fixRequestedDone: {
    uz: '✏️ {number} bo‘yicha tuzatish so‘raldi.',
    ru: '✏️ По {number} запрошена правка.',
  },
  alreadyProcessed: {
    uz: 'Ariza allaqachon qayta ishlangan.',
    ru: 'Заявка уже обработана.',
  },
  refundsEmpty: {
    uz: 'Qaytarish so‘rovi yo‘q.',
    ru: 'Нет запросов на возврат.',
  },
  refundCard: {
    uz: '↩️ Qaytarish {number} ({index}/{total})\n💰 Summa: {amount}\n📝 Sabab: {reason}\n📎 Isbot: {files} ta',
    ru: '↩️ Возврат {number} ({index}/{total})\n💰 Сумма: {amount}\n📝 Причина: {reason}\n📎 Подтверждение: {files} шт.',
  },
  refundApproved: {
    uz: '✅ Qaytarish so‘rovi tasdiqlandi.',
    ru: '✅ Запрос на возврат одобрен.',
  },
  refundRejected: {
    uz: '❌ Qaytarish so‘rovi rad etildi.',
    ru: '❌ Запрос на возврат отклонён.',
  },
  refundChooseExpense: {
    uz: '↩️ Qaysi xarajat bo‘yicha pul qaytarilyapti?',
    ru: '↩️ По какому расходу возвращаются деньги?',
  },
  refundNoExpenses: {
    uz: 'Qaytarish faqat tasdiqlangan xarajat bo‘yicha mumkin — bunday yozuv topilmadi.',
    ru: 'Возврат возможен только по одобренному расходу — таких записей нет.',
  },
  refundAskAmount: {
    uz: '💰 Qaytarilgan summani yuboring (eng ko‘pi {max}):',
    ru: '💰 Отправьте сумму возврата (не более {max}):',
  },
  refundAmountTooBig: {
    uz: 'Summa xarajat qoldig‘idan ({max}) oshmasligi kerak.',
    ru: 'Сумма не должна превышать остаток расхода ({max}).',
  },
  refundAskReason: {
    uz: '📝 Qaytarish sababini yozing (kamida {min} belgi):',
    ru: '📝 Напишите причину возврата (минимум {min} символов):',
  },
  refundAskProof: {
    uz: '📎 Isbotni yuboring (rasm yoki PDF) — majburiy:',
    ru: '📎 Отправьте подтверждение (фото или PDF) — обязательно:',
  },
  refundSubmitted: {
    uz: '↩️ Qaytarish so‘rovi yuborildi: {number}',
    ru: '↩️ Запрос на возврат отправлен: {number}',
  },
  editRequestsEmpty: {
    uz: 'Tahrirlash murojaati yo‘q.',
    ru: 'Нет заявок на правку.',
  },
  editCard: {
    uz: '✏️ Murojaat {number} ({index}/{total})\n👤 {employee}\n📝 {description}',
    ru: '✏️ Заявка {number} ({index}/{total})\n👤 {employee}\n📝 {description}',
  },
  editApply: { uz: '✅ Qabul qilish', ru: '✅ Принять' },
  editApplied: {
    uz: '✅ Murojaat qabul qilindi.',
    ru: '✅ Заявка принята.',
  },
  editRejected: {
    uz: '❌ Murojaat rad etildi.',
    ru: '❌ Заявка отклонена.',
  },
  editChooseExpense: {
    uz: '✏️ Qaysi xarajatni tahrirlash kerak?',
    ru: '✏️ Какой расход нужно исправить?',
  },
  editNoExpenses: {
    uz: 'Murojaat yuborish uchun xarajat topilmadi.',
    ru: 'Не найдено расходов для заявки.',
  },
  editAskDescription: {
    uz: '📝 Nima o‘zgarishi kerak va nima uchun (kamida {min} belgi):',
    ru: '📝 Что нужно изменить и почему (минимум {min} символов):',
  },
  editSubmitted: {
    uz: '✏️ Murojaat yuborildi: {number}',
    ru: '✏️ Заявка отправлена: {number}',
  },
  myExpensesHeader: {
    uz: '📋 Oxirgi xarajatlaringiz:',
    ru: '📋 Ваши последние расходы:',
  },
  branchExpensesHeader: {
    uz: '📋 Oxirgi xarajatlar:',
    ru: '📋 Последние расходы:',
  },
  expensesEmpty: {
    uz: 'Xarajat topilmadi.',
    ru: 'Расходы не найдены.',
  },
  statsHeader: {
    uz: '📊 Davr: {from} — {to}\n💰 Jami: {total}\n🧾 Yozuvlar: {count}\n↩️ Qaytarilgan: {refunded}',
    ru: '📊 Период: {from} — {to}\n💰 Итого: {total}\n🧾 Записей: {count}\n↩️ Возвращено: {refunded}',
  },
  statsPending: {
    uz: '⏳ Kutilmoqda: direktor {director}, admin {admin}',
    ru: '⏳ Ожидают: директор {director}, админ {admin}',
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

const STATUS_NAMES: Record<ExpenseStatus, Phrase> = {
  DRAFT: { uz: '📝 Qoralama', ru: '📝 Черновик' },
  DIRECTOR_PENDING: {
    uz: '⏳ Direktor tasdig‘i kutilmoqda',
    ru: '⏳ Ожидает директора',
  },
  ADMIN_PENDING: {
    uz: '⏳ Yakuniy tasdiq kutilmoqda',
    ru: '⏳ Ожидает финального подтверждения',
  },
  NEEDS_FIX: { uz: '✏️ Tuzatish so‘raldi', ru: '✏️ Запрошено исправление' },
  APPROVED: { uz: '✅ Tasdiqlangan', ru: '✅ Одобрен' },
  REJECTED: { uz: '❌ Rad etilgan', ru: '❌ Отклонён' },
  CANCELLED: { uz: '🚫 Bekor qilingan', ru: '🚫 Отменён' },
  PARTIALLY_REFUNDED: {
    uz: '↩️ Qisman qaytarilgan',
    ru: '↩️ Частично возвращён',
  },
  REFUNDED: { uz: '↩️ Qaytarilgan', ru: '↩️ Возвращён' },
};

export function statusName(status: ExpenseStatus, lang: Lang): string {
  return STATUS_NAMES[status][lang];
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
