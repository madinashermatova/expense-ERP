import { Prisma } from '../../generated/prisma/client';

export type Decimal = Prisma.Decimal;
export type MoneyInput = string | number | Prisma.Decimal;

/**
 * Pul arifmetikasi.
 *
 * Barcha hisob-kitob `Decimal` da bajariladi — `number` ishlatilmaydi, chunki
 * 0.1 + 0.2 ≠ 0.3 muammosi moliyaviy tizimda yo'l qo'yilmaydi. API ga esa har doim
 * string qaytariladi (TZ: frontendda arifmetika qilinmaydi).
 */
export const Money = {
  of(value: MoneyInput): Decimal {
    return new Prisma.Decimal(value);
  },

  /** Pul summasi — 2 kasr (tiyin) */
  round2(value: MoneyInput): Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(
      2,
      Prisma.Decimal.ROUND_HALF_UP,
    );
  },

  /** Kurs — 6 kasr */
  round6(value: MoneyInput): Decimal {
    return new Prisma.Decimal(value).toDecimalPlaces(
      6,
      Prisma.Decimal.ROUND_HALF_UP,
    );
  },

  add(a: MoneyInput, b: MoneyInput): Decimal {
    return new Prisma.Decimal(a).add(b);
  },

  sub(a: MoneyInput, b: MoneyInput): Decimal {
    return new Prisma.Decimal(a).sub(b);
  },

  mul(a: MoneyInput, b: MoneyInput): Decimal {
    return new Prisma.Decimal(a).mul(b);
  },

  sum(values: MoneyInput[]): Decimal {
    return values.reduce<Decimal>(
      (acc, v) => acc.add(v),
      new Prisma.Decimal(0),
    );
  },

  isPositive(value: MoneyInput): boolean {
    return new Prisma.Decimal(value).greaterThan(0);
  },

  equals(a: MoneyInput, b: MoneyInput): boolean {
    return new Prisma.Decimal(a).equals(b);
  },

  /** Valyutani UZS ga o'giradi: summa × kurs, 2 kasrgacha yaxlitlanadi */
  toUzs(amount: MoneyInput, rate: MoneyInput): Decimal {
    return Money.round2(new Prisma.Decimal(amount).mul(rate));
  },

  /** API javobi uchun — har doim string */
  toString(value: MoneyInput, decimals = 2): string {
    return new Prisma.Decimal(value).toFixed(decimals);
  },
};

/**
 * Summani N ta ulushga teng bo'ladi (TZ 3.6).
 *
 * Qoldiq tiyinlar **birinchi ulushga** qo'shiladi, shuning uchun ulushlar yig'indisi
 * har doim asl summaga aynan teng bo'ladi:
 *   100 000 / 3 → 33 333.34 + 33 333.33 + 33 333.33
 */
export function splitEqually(total: MoneyInput, parts: number): Decimal[] {
  if (parts < 1) throw new Error("parts kamida 1 bo'lishi kerak");

  const amount = Money.round2(total);
  const base = amount.div(parts).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
  const shares = Array.from({ length: parts }, () => base);
  const remainder = amount.sub(base.mul(parts));

  shares[0] = shares[0].add(remainder);
  return shares;
}
