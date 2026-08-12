import { Money, splitEqually } from './money';

describe('Money', () => {
  it("float xatosisiz qo'shadi", () => {
    expect(Money.add('0.1', '0.2').toString()).toBe('0.3');
  });

  it('2 kasrgacha yaxlitlaydi (yarim yuqoriga)', () => {
    expect(Money.round2('33333.335').toString()).toBe('33333.34');
    expect(Money.round2('33333.334').toString()).toBe('33333.33');
  });

  it("UZS ga o'girishda kursni qo'llaydi", () => {
    // 100 USD × 12 650.5 = 1 265 050
    expect(Money.toUzs('100', '12650.5').toString()).toBe('1265050');
  });

  it("UZS ga o'girishda natija 2 kasrga yaxlitlanadi", () => {
    expect(Money.toUzs('10.55', '12650.123456').toFixed(2)).toBe('133458.80');
  });

  it("yig'indi aniq hisoblanadi", () => {
    expect(Money.sum(['33333.34', '33333.33', '33333.33']).toString()).toBe(
      '100000',
    );
  });

  it('API uchun string qaytaradi', () => {
    expect(Money.toString('150000')).toBe('150000.00');
    expect(Money.toString('12650.5', 6)).toBe('12650.500000');
  });
});

describe('splitEqually (TZ 3.6 taqsimlash)', () => {
  it("teng bo'linadigan summani teng bo'ladi", () => {
    const shares = splitEqually('500000', 5);
    expect(shares.map((s) => s.toString())).toEqual([
      '100000',
      '100000',
      '100000',
      '100000',
      '100000',
    ]);
  });

  it("qoldiq tiyin birinchi ulushga qo'shiladi", () => {
    // TZ dagi aynan misol: 100 000 / 3
    const shares = splitEqually('100000', 3);
    expect(shares.map((s) => s.toFixed(2))).toEqual([
      '33333.34',
      '33333.33',
      '33333.33',
    ]);
  });

  it("ulushlar yig'indisi har doim asl summaga teng", () => {
    for (const [total, parts] of [
      ['100000', 3],
      ['1', 7],
      ['999999.99', 11],
      ['0.05', 4],
      ['123456.78', 13],
    ] as const) {
      const shares = splitEqually(total, parts);
      expect(Money.sum(shares).toFixed(2)).toBe(Money.round2(total).toFixed(2));
    }
  });

  it('bitta ulush — butun summa', () => {
    expect(splitEqually('150000', 1)[0].toString()).toBe('150000');
  });

  it('0 ta ulush xato beradi', () => {
    expect(() => splitEqually('100', 0)).toThrow();
  });
});
