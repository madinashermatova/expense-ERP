/**
 * TZ 3.16.1 / 5.3 — tenant middleware allow-list i.
 *
 * Bu jadvallar ataylab tenantdan tashqarida, chunki bitta Telegram akkaunt bir nechta
 * kompaniyaga tegishli bo'lishi mumkin, `Company` va `Plan` esa platforma darajasida.
 * Ular orqali biznes ma'lumotiga kirish har doim `activeLinkId → companyId` konteksti
 * bilan amalga oshiriladi.
 *
 * DIQQAT: bu ro'yxatga yangi model qo'shish — xavfsizlik qaroridir.
 * Har qanday qo'shimcha `tenant-isolation.int-spec.ts` da asoslanishi kerak.
 */
export const PLATFORM_MODELS = new Set<string>([
  'Company',
  'Plan',
  'TelegramSession',
  'TelegramLoginAttempt',
]);

/**
 * `companyId` ustuni yo'q, lekin biznes jadvali bo'lgan modellar.
 * Ular egasi orqali (FK) himoyalanadi va servis qatlamida tekshiriladi.
 */
export const NO_COMPANY_COLUMN_MODELS = new Set<string>([
  // RefreshToken — userId orqali bog'langan, User esa tenantga tegishli
  'RefreshToken',
  // CompanySubscription — companyId bor, lekin platforma amallari uchun ochiq qoladi
  'CompanySubscription',
]);

export function isTenantExempt(model: string | undefined): boolean {
  if (!model) return true;
  return PLATFORM_MODELS.has(model) || NO_COMPANY_COLUMN_MODELS.has(model);
}
