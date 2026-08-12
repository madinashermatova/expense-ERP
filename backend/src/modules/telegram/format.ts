import { Money } from '../../common/money/money';
import { Currency } from '../../generated/prisma/enums';
import { AppLanguage } from '../../common/i18n/languages';

const CURRENCY_LABEL: Record<Currency, { uz: string; ru: string }> = {
  UZS: { uz: "so'm", ru: 'сум' },
  USD: { uz: 'USD', ru: 'USD' },
};

/**
 * `150000` → `150 000 so'm`.
 *
 * Guruhlash oddiy bo'sh joy bilan: Telegram matnni baribir o'zi o'raydi, maxsus
 * belgi esa foydalanuvchi summani nusxalab boshqa joyga qo'yganda muammo tug'diradi.
 */
export function formatAmount(
  amount: string,
  currency: Currency,
  lang: AppLanguage,
): string {
  const value = Money.round2(amount);
  const [whole, fraction] = Money.toString(value).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimals = fraction && fraction !== '00' ? `.${fraction}` : '';

  return `${grouped}${decimals} ${CURRENCY_LABEL[currency][lang]}`;
}

/** ISO (`2026-08-06`) → `06.08.2026` */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

/**
 * Foydalanuvchi kiritgan summani o'qiydi: `150000`, `150 000`, `150000.50`, `100 USD`.
 * Valyuta ko'rsatilmasa UZS — kompaniyalarning asosiy valyutasi (TZ 3.5).
 */
export function parseAmount(
  input: string,
): { amount: string; currency: Currency } | null {
  // Ajratuvchi bo'lib kelgan uzilmaydigan bo'sh joylar (NBSP va h.k.) tozalanadi
  const cleaned = input
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .trim()
    .toUpperCase();

  const match = /^([\d\s]+(?:[.,]\d{1,2})?)\s*(UZS|USD|SO'M|СУМ|\$)?$/.exec(
    cleaned,
  );
  if (!match) return null;

  const digits = match[1].replace(/\s/g, '').replace(',', '.');
  const value = Number(digits);
  if (!Number.isFinite(value) || value <= 0) return null;

  const currency =
    match[2] === 'USD' || match[2] === '$' ? Currency.USD : Currency.UZS;

  return { amount: Money.toString(Money.round2(digits)), currency };
}

/**
 * `06.08.2026`, `6.8.2026`, `2026-08-06` → ISO sana.
 * Noto'g'ri yoki mavjud bo'lmagan sana (`31.02`) — `null`.
 */
export function parseDate(input: string): string | null {
  const trimmed = input.trim();

  const dotted = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(trimmed);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  let year: number;
  let month: number;
  let day: number;

  if (dotted) {
    day = Number(dotted[1]);
    month = Number(dotted[2]);
    year = Number(dotted[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  // `new Date` mavjud bo'lmagan sanani jim siljitadi (31.02 → 03.03) — tekshiriladi
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/** Bugungi sana ISO shaklida (bot xabarlari `Asia/Tashkent` da ko'rsatiladi) */
export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
