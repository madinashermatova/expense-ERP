/**
 * Yangi kompaniya uchun standart kategoriya daraxti (TZ 3.4).
 *
 * Bu **boshlang'ich qiymat**, qat'iy ro'yxat emas: kompaniya admini uni web dan
 * o'zgartiradi, kerakmasini arxivlaydi va o'zining kategoriyalarini qo'shadi
 * (savdo firmasida «Yoqilg'i», IT firmada «Litsenziya» va h.k.). Har kompaniyaning
 * daraxti `Category.companyId` orqali alohida — kodga tegish kerak emas.
 *
 * Ro'yxat ataylab bitta joyda: uni ham `prisma/seed.ts` (dev ma'lumoti), ham
 * `CategoriesService.applyDefaults()` (yangi kompaniya) ishlatadi.
 */
export interface DefaultCategory {
  uz: string;
  ru: string;
  receiptRequired?: boolean;
  commentRequired?: boolean;
  children?: DefaultCategory[];
}

export const DEFAULT_CATEGORY_TREE: readonly DefaultCategory[] = [
  {
    uz: 'Ovqatlanish',
    ru: 'Питание',
    children: [
      { uz: 'Tushlik', ru: 'Обед' },
      {
        uz: 'Korporativ tadbir',
        ru: 'Корпоративное мероприятие',
        receiptRequired: true,
      },
      { uz: 'Suv/choy', ru: 'Вода/чай' },
    ],
  },
  {
    uz: 'Malaka oshirish',
    ru: 'Повышение квалификации',
    children: [
      { uz: 'Kurs', ru: 'Курс', receiptRequired: true },
      { uz: 'Trening', ru: 'Тренинг', receiptRequired: true },
      { uz: 'Sertifikat', ru: 'Сертификат', receiptRequired: true },
      { uz: 'Kitob/materiallar', ru: 'Книги/материалы' },
    ],
  },
  {
    uz: 'Transport',
    ru: 'Транспорт',
    children: [
      { uz: "Yo'l xarajati", ru: 'Дорожные расходы' },
      { uz: 'Taksi', ru: 'Такси' },
      { uz: "Yoqilg'i", ru: 'Топливо', receiptRequired: true },
    ],
  },
  {
    uz: "Sog'liq",
    ru: 'Здоровье',
    children: [
      { uz: "Med. ko'rik", ru: 'Медосмотр', receiptRequired: true },
      { uz: "Sug'urta", ru: 'Страховка', receiptRequired: true },
    ],
  },
  {
    uz: 'Ish jihozlari',
    ru: 'Рабочее оборудование',
    children: [
      { uz: 'Forma', ru: 'Форма' },
      { uz: 'Asboblar', ru: 'Инструменты', receiptRequired: true },
      { uz: 'Kanselyariya', ru: 'Канцелярия' },
    ],
  },
  { uz: 'Boshqa', ru: 'Прочее', commentRequired: true },
];

/** Daraxtdagi kategoriyalar soni (bosh + ichki) — testlar va loglar uchun */
export function countDefaultCategories(): number {
  return DEFAULT_CATEGORY_TREE.reduce(
    (total, parent) => total + 1 + (parent.children?.length ?? 0),
    0,
  );
}
