import { resolvePeriod } from './period';

const iso = (date: Date): string => date.toISOString().slice(0, 10);

describe('Hisobot davri (TZ 3.13)', () => {
  describe('kalendar oy (startDay = 1)', () => {
    it('oy boshi va oxiri to‘g‘ri chiqadi', () => {
      const period = resolvePeriod(new Date('2026-08-12T10:00:00.000Z'), 1);

      expect(period.key).toBe('2026-08');
      expect(iso(period.start)).toBe('2026-08-01');
      expect(iso(period.end)).toBe('2026-08-31');
    });

    it('fevral uzunligi yilga qarab o‘zgaradi', () => {
      expect(
        iso(resolvePeriod(new Date('2026-02-10T00:00:00.000Z'), 1).end),
      ).toBe('2026-02-28');
      // 2028 — kabisa yili
      expect(
        iso(resolvePeriod(new Date('2028-02-10T00:00:00.000Z'), 1).end),
      ).toBe('2028-02-29');
    });
  });

  describe('sozlanadigan davr (startDay = 25)', () => {
    it('25-dan keyingi sana joriy oyda boshlangan davrga tushadi', () => {
      const period = resolvePeriod(new Date('2026-08-26T00:00:00.000Z'), 25);

      expect(period.key).toBe('2026-08');
      expect(iso(period.start)).toBe('2026-08-25');
      expect(iso(period.end)).toBe('2026-09-24');
    });

    it('25-dan oldingi sana o‘tgan oyda boshlangan davrga tushadi', () => {
      const period = resolvePeriod(new Date('2026-08-12T00:00:00.000Z'), 25);

      expect(period.key).toBe('2026-07');
      expect(iso(period.start)).toBe('2026-07-25');
      expect(iso(period.end)).toBe('2026-08-24');
    });

    it('aynan 25-chi kun yangi davrni boshlaydi', () => {
      const period = resolvePeriod(new Date('2026-08-25T00:00:00.000Z'), 25);
      expect(iso(period.start)).toBe('2026-08-25');
    });

    it('yil chegarasidan o‘tadi', () => {
      const period = resolvePeriod(new Date('2027-01-10T00:00:00.000Z'), 25);

      expect(period.key).toBe('2026-12');
      expect(iso(period.start)).toBe('2026-12-25');
      expect(iso(period.end)).toBe('2027-01-24');
    });
  });

  it('davrlar uzluksiz va bir-birining ustiga tushmaydi', () => {
    const first = resolvePeriod(new Date('2026-08-12T00:00:00.000Z'), 25);
    const next = resolvePeriod(new Date('2026-08-25T00:00:00.000Z'), 25);

    expect(next.start.getTime() - first.end.getTime()).toBe(86_400_000);
  });

  it('chegaradan tashqari startDay 1–28 oralig‘iga siqiladi', () => {
    expect(
      iso(resolvePeriod(new Date('2026-08-12T00:00:00.000Z'), 0).start),
    ).toBe('2026-08-01');
    expect(
      iso(resolvePeriod(new Date('2026-08-30T00:00:00.000Z'), 31).start),
    ).toBe('2026-08-28');
  });
});
