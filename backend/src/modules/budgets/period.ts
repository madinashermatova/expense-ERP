/**
 * Hisobot davri (TZ 3.13) — byudjet ham shu davrga bog'lanadi (TZ 3.10).
 *
 * Sozlamadagi `report.periodStartDay` (1–28) davr boshlanish kunini belgilaydi:
 * `1` bo'lsa davr kalendar oyga teng, `25` bo'lsa 25-dan keyingi oyning 24-igacha.
 *
 * Davr **boshlangan oy** bilan nomlanadi (`2026-07` = 25.07–24.08): `startDay = 1`
 * bo'lganda kalit kalendar oyga aynan mos tushadi, ya'ni sukut holatda hech qanday
 * siljish yo'q. Kalit faqat ichki maqsadda (ogohlantirish takrorlanmasligi uchun)
 * ishlatiladi — API har doim `periodStart` va `periodEnd` sanalarini ham qaytaradi.
 */
export interface Period {
  /** `YYYY-MM` — `BudgetAlert.period` uchun kalit */
  key: string;
  /** Davr boshlanish kuni (UTC yarim tuni) */
  start: Date;
  /** Davr oxirgi kuni (UTC yarim tuni, inklyuziv) */
  end: Date;
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
}

/** Berilgan sana tushadigan davrni qaytaradi */
export function resolvePeriod(date: Date, startDay: number): Period {
  const day = Math.min(Math.max(Math.trunc(startDay), 1), 28);

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  // Sana davr boshlanishidan oldin bo'lsa, davr o'tgan oyda boshlangan
  const startsThisMonth = date.getUTCDate() >= day;
  const start = startsThisMonth
    ? utcDate(year, month, day)
    : utcDate(year, month - 1, day);

  // Keyingi davr boshlanishidan bir kun oldin
  const nextStart = utcDate(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    day,
  );
  const end = new Date(nextStart.getTime() - 86_400_000);

  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;

  return { key, start, end };
}
