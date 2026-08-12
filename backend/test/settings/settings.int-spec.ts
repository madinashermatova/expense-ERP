import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { ReportCacheService } from '../../src/modules/reports/report-cache.service';
import { SettingsService } from '../../src/modules/settings/settings.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

/** TZ 3.15 — sozlamalar: faqat admin, darhol kuchga kiradi, har o'zgarish auditga */
describe('Sozlamalar (TZ 3.15)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let settings: SettingsService;
  let cache: ReportCacheService;
  let alfa: SeededCompany;
  let admin: Session;
  let director: Session;

  const http = () => request(app.getHttpServer() as App);

  const patch = async (body: Record<string, unknown>, expected = 200) => {
    const res = await http()
      .patch(API('/settings'))
      .set(...admin.header)
      .send(body);

    if (res.status !== expected) {
      throw new Error(
        `PATCH /settings → ${res.status}: ${JSON.stringify(res.body)}`,
      );
    }
    return res.body;
  };

  beforeAll(async () => {
    const ctx = await createHttpApp();
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;
    settings = app.get(SettingsService);
    cache = app.get(ReportCacheService);
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    alfa = await seedCompany(prisma, 'alfa', 'alfa.uz');
    admin = await loginAs(app, alfa.adminEmail);
    director = await loginAs(app, alfa.directorEmail);

    settings.clearCache();
    await cache.invalidate(alfa.companyId);
  });

  // ─── Ruxsat ────────────────────────────────────────────────────────────────

  it("direktor sozlamalarni ko'ra ham, o'zgartira ham olmaydi (403)", async () => {
    await http()
      .get(API('/settings'))
      .set(...director.header)
      .expect(403);

    await http()
      .patch(API('/settings'))
      .set(...director.header)
      .send({ reportPeriodStartDay: 25 })
      .expect(403);
  });

  // ─── O'qish ────────────────────────────────────────────────────────────────

  it('sozlanmagan kompaniyada standart qiymatlar qaytadi', async () => {
    const res = await http()
      .get(API('/settings'))
      .set(...admin.header)
      .expect(200);

    expect(res.body).toEqual({
      currencyBase: 'AUTO',
      reportPeriodStartDay: 1,
      approvalReminderHours: 24,
      expenseEditWindowHours: 24,
      defaultLanguage: 'UZ',
      workDays: [1, 2, 3, 4, 5, 6],
      notificationsEnabled: true,
    });
  });

  // ─── Yozish ────────────────────────────────────────────────────────────────

  it("noto'g'ri qiymat rad etiladi", async () => {
    // Loyihaning yagona xato formati: validatsiya → 422 VALIDATION_FAILED
    await patch({ reportPeriodStartDay: 29 }, 422);
    await patch({ approvalReminderHours: 0 }, 422);
    await patch({ workDays: [0, 9] }, 422);
    await patch({ notmaydon: true }, 422);
  });

  it("o'zgarish darhol kuchga kiradi — hisobot davri 25-dan boshlanadi", async () => {
    await patch({ reportPeriodStartDay: 25 });

    const res = await http()
      .get(API('/reports/summary'))
      .set(...admin.header)
      .expect(200);

    expect(res.body.period.from.slice(-2)).toBe('25');
  });

  it("tahrirlash oynasi sozlamasi xarajat tahririga ta'sir qiladi", async () => {
    await patch({ expenseEditWindowHours: 48 });

    const stored = await prisma.raw.setting.findUniqueOrThrow({
      where: {
        companyId_key: {
          companyId: alfa.companyId,
          key: 'expense.editWindowHours',
        },
      },
    });

    expect(stored.value).toEqual({ hours: 48 });
    expect(stored.updatedByUserId).toBe(alfa.adminId);
  });

  it('standart til kompaniya yozuvida ham yangilanadi', async () => {
    await patch({ defaultLanguage: 'RU' });

    const company = await prisma.raw.company.findUniqueOrThrow({
      where: { id: alfa.companyId },
    });

    expect(company.defaultLanguage).toBe('RU');
  });

  // ─── Audit ─────────────────────────────────────────────────────────────────

  it("har bir o'zgarish audit jurnaliga eski→yangi bilan tushadi", async () => {
    await patch({ reportPeriodStartDay: 25, notificationsEnabled: false });

    const entries = await prisma.raw.auditLog.findMany({
      where: { companyId: alfa.companyId, action: 'settings.update' },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].changes).toEqual([
      { field: 'reportPeriodStartDay', old: 1, new: 25 },
      { field: 'notificationsEnabled', old: true, new: false },
    ]);
  });

  it("qiymat o'zgarmagan bo'lsa audit yozuvi yaratilmaydi", async () => {
    await patch({ reportPeriodStartDay: 1, currencyBase: 'AUTO' });

    const entries = await prisma.raw.auditLog.findMany({
      where: { companyId: alfa.companyId, action: 'settings.update' },
    });

    expect(entries).toHaveLength(0);
  });

  // ─── Bildirishnomalarni o'chirish ──────────────────────────────────────────

  it("bildirishnomalar o'chirilganda yangi xabar yaratilmaydi", async () => {
    await patch({ notificationsEnabled: false });

    const category = await prisma.raw.category.create({
      data: { companyId: alfa.companyId, nameUz: 'Ofis', nameRu: 'Офис' },
    });
    const employee = await prisma.raw.employee.findFirstOrThrow({
      where: { companyId: alfa.companyId, branchId: alfa.branchIds[0] },
    });

    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send({
        branchId: alfa.branchIds[0],
        categoryId: category.id,
        employeeIds: [employee.id],
        amount: '150000.00',
        currency: 'UZS',
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: 'CASH',
      })
      .expect(201);

    const notifications = await prisma.raw.notification.count({
      where: { companyId: alfa.companyId },
    });

    expect(notifications).toBe(0);
  });
});
