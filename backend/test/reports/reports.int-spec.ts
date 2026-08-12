import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { ReportCacheService } from '../../src/modules/reports/report-cache.service';
import {
  SETTING_KEYS,
  SettingsService,
} from '../../src/modules/settings/settings.service';
import { TenantContextService } from '../../src/common/tenancy/tenant-context.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

describe('Hisobotlar (TZ 3.13)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let cache: ReportCacheService;
  let settings: SettingsService;
  let tenant: TenantContextService;
  let alfa: SeededCompany;
  let admin: Session;
  let admin2: Session;
  let director: Session;
  let ofis: string;
  let texnika: string;
  let employees: { id: string; branchId: string }[];

  const http = () => request(app.getHttpServer() as App);
  const today = (): string => new Date().toISOString().slice(0, 10);

  /**
   * Xarajat yaratib, ikki bosqichdan o'tkazadi — hisobotga faqat tasdiqlanganlar kiradi.
   * `approve: false` bo'lsa navbatda qoladi.
   */
  const addExpense = async (over: {
    amount: string;
    categoryId?: string;
    branchId?: string;
    employeeIds?: string[];
    date?: string;
    currency?: string;
    paymentMethod?: string;
    approve?: boolean;
  }): Promise<string> => {
    const branchId = over.branchId ?? alfa.branchIds[0];
    const employeeIds = over.employeeIds ?? [
      employees.find((e) => e.branchId === branchId)?.id as string,
    ];

    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send({
        branchId,
        categoryId: over.categoryId ?? ofis,
        employeeIds,
        amount: over.amount,
        currency: over.currency ?? 'UZS',
        date: over.date ?? today(),
        paymentMethod: over.paymentMethod ?? 'CASH',
      })
      .expect(201);

    const id = res.body.id as string;
    if (over.approve === false) return id;

    // Direktor faqat o'z filialida qaror qabul qila oladi; boshqa filialda
    // 1-bosqichni bosh admin hal qiladi (TZ 3.7 jadvali)
    const stageOne = branchId === alfa.branchIds[0] ? director : admin;
    await http()
      .post(API(`/expenses/${id}/approve`))
      .set(...stageOne.header)
      .send({})
      .expect(201);
    await http()
      .post(API(`/expenses/${id}/approve`))
      .set(...admin2.header)
      .send({})
      .expect(201);

    return id;
  };

  beforeAll(async () => {
    const ctx = await createHttpApp();
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;
    cache = app.get(ReportCacheService);
    settings = app.get(SettingsService);
    tenant = app.get(TenantContextService);
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    alfa = await seedCompany(prisma, 'alfa', 'alfa.uz');
    admin = await loginAs(app, alfa.adminEmail);
    admin2 = await loginAs(app, alfa.admin2Email);
    director = await loginAs(app, alfa.directorEmail);

    const a = await prisma.raw.category.create({
      data: { companyId: alfa.companyId, nameUz: 'Ofis', nameRu: 'Офис' },
    });
    const b = await prisma.raw.category.create({
      data: { companyId: alfa.companyId, nameUz: 'Texnika', nameRu: 'Техника' },
    });
    ofis = a.id;
    texnika = b.id;

    employees = await prisma.raw.employee.findMany({
      where: { companyId: alfa.companyId },
      select: { id: true, branchId: true },
      orderBy: { fullName: 'asc' },
    });

    // Kesh testlar orasida qolib ketmasligi kerak
    await cache.invalidate(alfa.companyId);
    settings.clearCache();
  });

  // ─── Summary ───────────────────────────────────────────────────────────────

  it('faqat tasdiqlangan xarajatlar hisobga olinadi', async () => {
    await addExpense({ amount: '300000.00' });
    await addExpense({ amount: '500000.00', approve: false });

    const res = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);

    expect(res.body.totalUzs).toBe('300000.00');
    expect(res.body.expenseCount).toBe(1);
    // Navbat ko'rsatkichi 1-bosqich va 2-bosqichni alohida ko'rsatadi
    expect(res.body.pendingDirectorCount).toBe(1);
    expect(res.body.pendingAdminCount).toBe(0);
  });

  it('davr sukut bo‘yicha kalendar oy', async () => {
    const res = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);

    const month = today().slice(0, 7);
    expect(res.body.period.key).toBe(month);
    expect(res.body.period.from).toBe(`${month}-01`);
  });

  it('davr boshlanish kuni 25 bo‘lsa oraliq 25-dan 24-gacha', async () => {
    await tenant.runAsync({ companyId: alfa.companyId }, () =>
      settings.set(SETTING_KEYS.reportPeriodStartDay, { day: 25 }),
    );

    const res = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);

    expect(res.body.period.from.slice(-2)).toBe('25');
    expect(res.body.period.to.slice(-2)).toBe('24');
  });

  it('o‘tgan davr ham so‘raladi', async () => {
    const current = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);

    const previous = await http()
      .get(API('/reports/summary'))
      .query({ period: 'previous' })
      .set(...admin.header)
      .expect(200);

    const previousTo = previous.body.period.to as string;
    const currentFrom = current.body.period.from as string;
    expect(new Date(previousTo).getTime()).toBeLessThan(
      new Date(currentFrom).getTime(),
    );
  });

  it('qaytarish effektiv summani kamaytiradi', async () => {
    const id = await addExpense({ amount: '500000.00' });

    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 7),
    ]);

    const refund = await http()
      .post(API('/refunds'))
      .set(...admin.header)
      .field('expenseId', id)
      .field('amount', '200000.00')
      .field('reason', 'Tovar qaytarildi, pul qaytdi')
      .attach('files', png, { filename: 'k.png', contentType: 'image/png' })
      .expect(201);

    for (const session of [director, admin2]) {
      await http()
        .post(API(`/refunds/${refund.body.id}/approve`))
        .set(...session.header)
        .send({})
        .expect(201);
    }

    await cache.invalidate(alfa.companyId);

    const res = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);

    expect(res.body.totalUzs).toBe('300000.00');
    expect(res.body.refundedUzs).toBe('200000.00');
  });

  it('aralash valyutada jami UZS da, har bir valyuta alohida ko‘rinadi', async () => {
    await prisma.raw.currencyRate.create({
      data: {
        companyId: alfa.companyId,
        date: new Date(`${today()}T00:00:00.000Z`),
        currency: 'USD',
        rate: '12500.000000',
        source: 'AUTO',
      },
    });

    await addExpense({ amount: '250000.00' });
    await addExpense({ amount: '100.00', currency: 'USD' });

    const res = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);

    expect(res.body.totalUzs).toBe('1500000.00');

    const usd = (
      res.body.byCurrency as { currency: string; amount: string }[]
    ).find((c) => c.currency === 'USD');
    expect(usd?.amount).toBe('100.00');
  });

  // ─── Kesimlar ──────────────────────────────────────────────────────────────

  it('filiallar kesimi ulush va xodimga o‘rtacha bilan qaytadi', async () => {
    const second = employees.find((e) => e.branchId === alfa.branchIds[1]);
    if (!second) {
      await prisma.raw.employee.create({
        data: {
          companyId: alfa.companyId,
          fullName: 'Ikkinchi filial xodimi',
          branchId: alfa.branchIds[1],
        },
      });
      employees = await prisma.raw.employee.findMany({
        where: { companyId: alfa.companyId },
        select: { id: true, branchId: true },
      });
    }

    await addExpense({ amount: '750000.00' });
    await addExpense({
      amount: '250000.00',
      branchId: alfa.branchIds[1],
      employeeIds: [
        employees.find((e) => e.branchId === alfa.branchIds[1])?.id as string,
      ],
    });

    const res = await http()
      .get(API('/reports/by-branch'))
      .set(...admin.header)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].totalAmount).toBe('750000.00');
    expect(res.body[0].share).toBe(75);
    expect(res.body[0].employeeCount).toBeGreaterThan(0);
    expect(res.body[1].share).toBe(25);
  });

  it('kategoriyalar kesimi frontend jadvali maydonlarini qaytaradi', async () => {
    await addExpense({ amount: '400000.00', categoryId: ofis });
    await addExpense({ amount: '100000.00', categoryId: texnika });

    const res = await http()
      .get(API('/reports/by-category'))
      .set(...admin.header)
      .expect(200);

    expect(res.body[0]).toMatchObject({
      group: 'Ofis',
      count: 1,
      totalAmount: '400000.00',
      share: 80,
    });
  });

  it('xodimlar kesimi ulushlar bo‘yicha, sukut bo‘yicha TOP-10', async () => {
    const two = employees
      .filter((e) => e.branchId === alfa.branchIds[0])
      .slice(0, 2)
      .map((e) => e.id);

    await addExpense({ amount: '100000.00', employeeIds: two });

    const res = await http()
      .get(API('/reports/by-employee'))
      .set(...admin.header)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].totalAmount).toBe('50000.00');
    expect(res.body[0].branchName).toBe('Birinchi filial');
    expect(res.body.length).toBeLessThanOrEqual(10);
  });

  it('xodimlar kesimida limit ishlaydi', async () => {
    const three = employees
      .filter((e) => e.branchId === alfa.branchIds[0])
      .slice(0, 3)
      .map((e) => e.id);

    await addExpense({ amount: '300000.00', employeeIds: three });

    const res = await http()
      .get(API('/reports/by-employee'))
      .query({ limit: 2 })
      .set(...admin.header)
      .expect(200);

    expect(res.body).toHaveLength(2);
  });

  it('dinamika oylar kesimida trend qaytaradi', async () => {
    await addExpense({ amount: '100000.00', date: '2026-06-15' });
    await addExpense({ amount: '200000.00', date: '2026-07-15' });

    const res = await http()
      .get(API('/reports/dynamics'))
      .query({ dateFrom: '2026-06-01', dateTo: '2026-07-31' })
      .set(...admin.header)
      .expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].bucket).toBe('2026-06-01');
    expect(res.body[0].totalAmount).toBe('100000.00');
    expect(res.body[1].totalAmount).toBe('200000.00');
  });

  it('byudjet vs fakt limitni fakt bilan yonma-yon beradi', async () => {
    await http()
      .post(API('/budgets'))
      .set(...admin.header)
      .send({
        scope: 'BRANCH',
        scopeId: alfa.branchIds[0],
        amount: '1000000.00',
        effectiveFrom: `${today().slice(0, 7)}-01`,
      })
      .expect(201);

    await addExpense({ amount: '400000.00' });
    await cache.invalidate(alfa.companyId);

    const res = await http()
      .get(API('/reports/budget-vs-actual'))
      .set(...admin.header)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      limit: '1000000.00',
      actual: '400000.00',
      variance: '600000.00',
      usedPercent: 40,
    });
  });

  // ─── Filtrlar ──────────────────────────────────────────────────────────────

  it('filtrlar qo‘llanadi', async () => {
    await addExpense({ amount: '100000.00', paymentMethod: 'CASH' });
    await addExpense({ amount: '200000.00', paymentMethod: 'CARD' });

    const byMethod = await http()
      .get(API('/reports/summary'))
      .query({ paymentMethod: 'CARD' })
      .set(...admin.header)
      .expect(200);
    expect(byMethod.body.totalUzs).toBe('200000.00');

    const byCategory = await http()
      .get(API('/reports/summary'))
      .query({ categoryId: texnika })
      .set(...admin.header)
      .expect(200);
    expect(byCategory.body.totalUzs).toBe('0.00');
  });

  it('sana oralig‘i sozlamadagi davrdan ustun turadi', async () => {
    await addExpense({ amount: '100000.00', date: '2026-03-10' });

    const res = await http()
      .get(API('/reports/summary'))
      .query({ dateFrom: '2026-03-01', dateTo: '2026-03-31' })
      .set(...admin.header)
      .expect(200);

    expect(res.body.totalUzs).toBe('100000.00');
    expect(res.body.period.key).toBeNull();
  });

  // ─── Doira va izolyatsiya ──────────────────────────────────────────────────

  it('direktor faqat o‘z filialini ko‘radi', async () => {
    const other = await prisma.raw.employee.create({
      data: {
        companyId: alfa.companyId,
        fullName: 'Begona',
        branchId: alfa.branchIds[1],
      },
    });

    await addExpense({ amount: '100000.00' });
    await addExpense({
      amount: '900000.00',
      branchId: alfa.branchIds[1],
      employeeIds: [other.id],
    });

    const res = await http()
      .get(API('/reports/summary'))
      .set(...director.header)
      .expect(200);
    expect(res.body.totalUzs).toBe('100000.00');

    const branches = await http()
      .get(API('/reports/by-branch'))
      .set(...director.header)
      .expect(200);
    expect(branches.body).toHaveLength(1);
  });

  it('direktor boshqa filial branchId si bilan so‘rasa 403', async () => {
    const res = await http()
      .get(API('/reports/summary'))
      .query({ branchId: alfa.branchIds[1] })
      .set(...director.header)
      .expect(403);

    expect(res.body.code).toBe('BRANCH_FORBIDDEN');
  });

  it('kesh boshqa kompaniyaga oqib ketmaydi', async () => {
    await addExpense({ amount: '777000.00' });

    const alfaRes = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);
    expect(alfaRes.body.totalUzs).toBe('777000.00');

    const beta = await seedCompany(prisma, 'beta', 'beta.uz');
    const betaAdmin = await loginAs(app, beta.adminEmail);

    const betaRes = await http()
      .get(API('/reports/summary'))
      .set(...betaAdmin.header)
      .expect(200);
    expect(betaRes.body.totalUzs).toBe('0.00');
  });

  it('kesh takroriy so‘rovda ishlaydi va invalidatsiya qilinadi', async () => {
    await addExpense({ amount: '100000.00' });

    const first = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);
    expect(first.body.totalUzs).toBe('100000.00');

    // Keshda eski qiymat turadi — yangi xarajat darhol ko'rinmaydi
    await addExpense({ amount: '50000.00' });
    const cached = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);
    expect(cached.body.totalUzs).toBe('100000.00');

    await cache.invalidate(alfa.companyId);
    const fresh = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);
    expect(fresh.body.totalUzs).toBe('150000.00');
  });
});
