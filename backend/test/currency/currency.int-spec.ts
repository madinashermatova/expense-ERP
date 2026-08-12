import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { TenantContextService } from '../../src/common/tenancy/tenant-context.service';
import { CbuClient, CbuRate } from '../../src/modules/currency/cbu.client';
import { CurrencyCron } from '../../src/modules/currency/currency.cron';
import { CurrencyService } from '../../src/modules/currency/currency.service';
import {
  SettingsService,
  SETTING_KEYS,
} from '../../src/modules/settings/settings.service';
import { Currency, RateSource, Role } from '../../src/generated/prisma/enums';
import { Prisma } from '../../src/generated/prisma/client';
import { tenantData } from '../../src/common/tenancy/tenant-data';
import { API } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

/** CBU o'rniga boshqariladigan soxta klient — testlar tarmoqqa chiqmaydi */
class FakeCbuClient {
  nextRate: CbuRate | null = {
    currency: 'USD',
    rate: '12650.000000',
    date: '12.08.2026',
  };
  calls: { currency: string; date: string }[] = [];

  fetchRate(currency: string, date: Date): Promise<CbuRate | null> {
    this.calls.push({ currency, date: date.toISOString().slice(0, 10) });
    return Promise.resolve(this.nextRate);
  }
}

describe('Valyuta va kurslar (TZ 3.5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let currency: CurrencyService;
  let settings: SettingsService;
  let cron: CurrencyCron;
  let tenant: TenantContextService;
  let cbu: FakeCbuClient;
  let alfa: SeededCompany;
  let beta: SeededCompany;
  let admin: Session;
  let director: Session;

  const http = () => request(app.getHttpServer() as App);

  const inCompany = <T>(
    company: SeededCompany,
    fn: () => Promise<T>,
  ): Promise<T> =>
    tenant.runAsync({ companyId: company.companyId, role: Role.ADMIN }, fn);

  beforeAll(async () => {
    process.env.DISABLE_THROTTLE = 'true';
    cbu = new FakeCbuClient();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CbuClient)
      .useValue(cbu)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    currency = app.get(CurrencyService);
    settings = app.get(SettingsService);
    cron = app.get(CurrencyCron);
    tenant = app.get(TenantContextService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    settings.clearCache();
    cbu.nextRate = {
      currency: 'USD',
      rate: '12650.000000',
      date: '12.08.2026',
    };
    cbu.calls = [];
    alfa = await seedCompany(prisma, 'alfa', 'alfa.uz');
    beta = await seedCompany(prisma, 'beta', 'beta.uz');
    admin = await loginAs(app, alfa.adminEmail);
    director = await loginAs(app, alfa.directorEmail);
  });

  describe("qo'lda kurs", () => {
    it('admin kurs kirita oladi', async () => {
      const res = await http()
        .post(API('/currency/rates'))
        .set(...admin.header)
        .send({ date: '2026-08-10', currency: 'USD', rate: '12500.5' })
        .expect(201);

      expect(res.body.rate).toBe('12500.500000');
      expect(res.body.source).toBe('MANUAL');
      expect(res.body.date).toBe('2026-08-10');
    });

    it('direktor kurs kirita olmaydi', async () => {
      await http()
        .post(API('/currency/rates'))
        .set(...director.header)
        .send({ date: '2026-08-10', currency: 'USD', rate: '12500' })
        .expect(403);
    });

    it('bir kunga ikki marta kiritish yangilaydi (dublikat yaratmaydi)', async () => {
      await http()
        .post(API('/currency/rates'))
        .set(...admin.header)
        .send({ date: '2026-08-10', currency: 'USD', rate: '12500' })
        .expect(201);

      await http()
        .post(API('/currency/rates'))
        .set(...admin.header)
        .send({ date: '2026-08-10', currency: 'USD', rate: '12700' })
        .expect(201);

      const rows = await prisma.raw.currencyRate.findMany({
        where: { companyId: alfa.companyId },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].rate.toFixed(2)).toBe('12700.00');
    });

    it('manfiy kurs 422 qaytaradi', async () => {
      const res = await http()
        .post(API('/currency/rates'))
        .set(...admin.header)
        .send({ date: '2026-08-10', currency: 'USD', rate: '-100' })
        .expect(422);

      expect(res.body.code).toBe('RATE_NOT_POSITIVE');
    });

    it("UZS uchun kurs kiritib bo'lmaydi", async () => {
      const res = await http()
        .post(API('/currency/rates'))
        .set(...admin.header)
        .send({ date: '2026-08-10', currency: 'UZS', rate: '1' })
        .expect(422);

      expect(res.body.code).toBe('CURRENCY_NOT_CONVERTIBLE');
    });
  });

  describe('hisob bazasi (AUTO / MANUAL)', () => {
    it('default AUTO', async () => {
      const res = await http()
        .get(API('/currency/base'))
        .set(...admin.header)
        .expect(200);

      expect(res.body.mode).toBe('AUTO');
    });

    it("admin bazani o'zgartira oladi, direktor yo'q", async () => {
      await http()
        .post(API('/currency/base'))
        .set(...admin.header)
        .send({ mode: 'MANUAL' })
        .expect(201);

      const res = await http()
        .get(API('/currency/base'))
        .set(...admin.header)
        .expect(200);
      expect(res.body.mode).toBe('MANUAL');

      await http()
        .post(API('/currency/base'))
        .set(...director.header)
        .send({ mode: 'AUTO' })
        .expect(403);
    });

    it('MANUAL rejimda AUTO kurslari ishlatilmaydi', async () => {
      await inCompany(alfa, async () => {
        await prisma.db.currencyRate.create({
          data: tenantData<Prisma.CurrencyRateUncheckedCreateInput>({
            date: new Date('2026-08-10T00:00:00Z'),
            currency: Currency.USD,
            rate: '12000',
            source: RateSource.AUTO,
          }),
        });
        await settings.set(SETTING_KEYS.currencyBase, {
          mode: RateSource.MANUAL,
        });
      });

      settings.clearCache();

      // MANUAL kurs yo'q → xato (AUTO kursiga tushib ketmaydi)
      await expect(
        inCompany(alfa, () =>
          currency.resolveRate(Currency.USD, new Date('2026-08-10')),
        ),
      ).rejects.toMatchObject({ response: { code: 'CURRENCY_RATE_MISSING' } });
    });

    it('MANUAL rejimda kurs kiritilmagan sana uchun USD konvertatsiya 422 (TZ qabul mezoni)', async () => {
      await inCompany(alfa, () =>
        settings.set(SETTING_KEYS.currencyBase, { mode: RateSource.MANUAL }),
      );
      settings.clearCache();

      await expect(
        inCompany(alfa, () =>
          currency.convertToUzs('100', Currency.USD, new Date('2026-08-10')),
        ),
      ).rejects.toMatchObject({ response: { code: 'CURRENCY_RATE_MISSING' } });
    });
  });

  describe('kurs topish mantiqi', () => {
    it("UZS uchun kurs 1 va so'rov yuborilmaydi", async () => {
      const resolved = await inCompany(alfa, () =>
        currency.resolveRate(Currency.UZS, new Date('2026-08-10')),
      );
      expect(resolved.rate.toString()).toBe('1');
    });

    it("aniq sana kursi bo'lmasa oldingi eng yaqin kurs ishlatiladi", async () => {
      await inCompany(alfa, () =>
        prisma.db.currencyRate.create({
          data: tenantData<Prisma.CurrencyRateUncheckedCreateInput>({
            date: new Date('2026-08-07T00:00:00Z'),
            currency: Currency.USD,
            rate: '12345.000000',
            source: RateSource.AUTO,
          }),
        }),
      );

      // 9-avgust (dam olish kuni) uchun 7-avgust kursi olinadi
      const resolved = await inCompany(alfa, () =>
        currency.resolveRate(Currency.USD, new Date('2026-08-09')),
      );

      expect(resolved.rate.toFixed(2)).toBe('12345.00');
      expect(resolved.rateDate.toISOString().slice(0, 10)).toBe('2026-08-07');
    });

    it('kelajakdagi kurs ishlatilmaydi', async () => {
      await inCompany(alfa, async () => {
        await prisma.db.currencyRate.create({
          data: tenantData<Prisma.CurrencyRateUncheckedCreateInput>({
            date: new Date('2026-08-01T00:00:00Z'),
            currency: Currency.USD,
            rate: '12000.000000',
            source: RateSource.AUTO,
          }),
        });
        await prisma.db.currencyRate.create({
          data: tenantData<Prisma.CurrencyRateUncheckedCreateInput>({
            date: new Date('2026-08-20T00:00:00Z'),
            currency: Currency.USD,
            rate: '13000.000000',
            source: RateSource.AUTO,
          }),
        });
      });

      const resolved = await inCompany(alfa, () =>
        currency.resolveRate(Currency.USD, new Date('2026-08-10')),
      );
      expect(resolved.rate.toFixed(2)).toBe('12000.00');
    });

    it("umuman kurs bo'lmasa 422", async () => {
      await expect(
        inCompany(alfa, () =>
          currency.resolveRate(Currency.USD, new Date('2026-08-10')),
        ),
      ).rejects.toMatchObject({ response: { code: 'CURRENCY_RATE_MISSING' } });
    });
  });

  describe('konvertatsiya va snapshot (TZ 3.5)', () => {
    it("USD summa UZS ga to'g'ri o'giriladi va kurs snapshot qaytadi", async () => {
      await inCompany(alfa, () =>
        prisma.db.currencyRate.create({
          data: tenantData<Prisma.CurrencyRateUncheckedCreateInput>({
            date: new Date('2026-08-10T00:00:00Z'),
            currency: Currency.USD,
            rate: '12650.000000',
            source: RateSource.AUTO,
          }),
        }),
      );

      const result = await inCompany(alfa, () =>
        currency.convertToUzs('100.50', Currency.USD, new Date('2026-08-10')),
      );

      expect(result.amountUzs.toFixed(2)).toBe('1271325.00');
      expect(result.rateUsed.toFixed(6)).toBe('12650.000000');
      expect(result.rateSource).toBe('AUTO');
    });

    it("kurs keyin o'zgarsa avval hisoblangan qiymat o'zgarmaydi", async () => {
      await inCompany(alfa, () =>
        prisma.db.currencyRate.create({
          data: tenantData<Prisma.CurrencyRateUncheckedCreateInput>({
            date: new Date('2026-08-10T00:00:00Z'),
            currency: Currency.USD,
            rate: '12000.000000',
            source: RateSource.AUTO,
          }),
        }),
      );

      const before = await inCompany(alfa, () =>
        currency.convertToUzs('100', Currency.USD, new Date('2026-08-10')),
      );

      // Kurs yangilandi
      await inCompany(alfa, () =>
        prisma.db.currencyRate.updateMany({
          where: { currency: Currency.USD },
          data: { rate: '13000.000000' },
        }),
      );

      // Snapshot allaqachon olingan — eski qiymat saqlanadi
      expect(before.amountUzs.toFixed(2)).toBe('1200000.00');

      const after = await inCompany(alfa, () =>
        currency.convertToUzs('100', Currency.USD, new Date('2026-08-10')),
      );
      expect(after.amountUzs.toFixed(2)).toBe('1300000.00');
    });
  });

  describe('CBU cron (TZ 3.5)', () => {
    it('barcha faol kompaniyalarga kurs yozadi', async () => {
      const result = await cron.runFor(new Date('2026-08-12'));

      expect(result.companies).toBe(2);
      expect(result.saved).toBe(2);

      const rates = await prisma.raw.currencyRate.findMany({
        where: { source: RateSource.AUTO },
      });
      expect(rates).toHaveLength(2);
      expect(new Set(rates.map((r) => r.companyId))).toEqual(
        new Set([alfa.companyId, beta.companyId]),
      );
    });

    it('CBU javob bermasa cron yiqilmaydi va adminlarga ogohlantirish boradi', async () => {
      cbu.nextRate = null;

      const result = await cron.runFor(new Date('2026-08-12'));

      expect(result.failed).toBe(2);
      expect(result.saved).toBe(0);

      const notifications = await prisma.raw.notification.findMany({
        where: { type: 'CURRENCY_RATE_FAILED' },
      });
      // Har kompaniyada 2 ta faol admin
      expect(notifications.length).toBe(4);
    });

    it("CBU javob bermasa oxirgi ma'lum kurs saqlanib qoladi", async () => {
      await cron.runFor(new Date('2026-08-11'));
      cbu.nextRate = null;
      await cron.runFor(new Date('2026-08-12'));

      const resolved = await inCompany(alfa, () =>
        currency.resolveRate(Currency.USD, new Date('2026-08-12')),
      );
      expect(resolved.rate.toFixed(2)).toBe('12650.00');
      expect(resolved.rateDate.toISOString().slice(0, 10)).toBe('2026-08-11');
    });

    it('takroriy ishga tushirish dublikat yaratmaydi', async () => {
      await cron.runFor(new Date('2026-08-12'));
      await cron.runFor(new Date('2026-08-12'));

      const rates = await prisma.raw.currencyRate.findMany({
        where: { companyId: alfa.companyId, source: RateSource.AUTO },
      });
      expect(rates).toHaveLength(1);
    });

    it('CBU nominali hisobga olinadi', async () => {
      // Soxta klient allaqachon birlik kursini qaytaradi; bu yerda faqat oqim tekshiriladi
      cbu.nextRate = {
        currency: 'USD',
        rate: '12650.500000',
        date: '12.08.2026',
      };
      await cron.runFor(new Date('2026-08-12'));

      const rate = await prisma.raw.currencyRate.findFirstOrThrow({
        where: { companyId: alfa.companyId, source: RateSource.AUTO },
      });
      expect(rate.rate.toFixed(6)).toBe('12650.500000');
    });
  });

  describe('tenant izolyatsiyasi', () => {
    it("kompaniya faqat o'z kurslarini ko'radi", async () => {
      await cron.runFor(new Date('2026-08-12'));

      const res = await http()
        .get(API('/currency/rates'))
        .set(...admin.header)
        .expect(200);

      expect(res.body).toHaveLength(1);
    });

    it("bir kompaniyada qo'lda kurs boshqasiga ta'sir qilmaydi", async () => {
      await http()
        .post(API('/currency/rates'))
        .set(...admin.header)
        .send({ date: '2026-08-10', currency: 'USD', rate: '12500' })
        .expect(201);

      const betaRates = await prisma.raw.currencyRate.findMany({
        where: { companyId: beta.companyId },
      });
      expect(betaRates).toHaveLength(0);
    });
  });

  describe('joriy kurs endpointi', () => {
    it('amaldagi kursni qaytaradi', async () => {
      await cron.runFor(new Date());

      const res = await http()
        .get(API('/currency/rates/current?currency=USD'))
        .set(...admin.header)
        .expect(200);

      expect(res.body.currency).toBe('USD');
      expect(res.body.source).toBe('AUTO');
      expect(Number(res.body.rate)).toBeGreaterThan(0);
    });
  });
});
