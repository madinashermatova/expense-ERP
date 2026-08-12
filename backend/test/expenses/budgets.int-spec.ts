import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

describe('Byudjet va limitlar (TZ 3.10)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let alfa: SeededCompany;
  let admin: Session;
  let admin2: Session;
  let director: Session;
  let categoryId: string;
  let employeeId: string;

  const http = () => request(app.getHttpServer() as App);

  const today = (): string => new Date().toISOString().slice(0, 10);
  const monthStart = (): string => `${today().slice(0, 7)}-01`;

  const payload = (over: Record<string, unknown> = {}) => ({
    branchId: alfa.branchIds[0],
    categoryId,
    employeeIds: [employeeId],
    amount: '100000.00',
    currency: 'UZS',
    date: today(),
    paymentMethod: 'CASH',
    ...over,
  });

  const createExpense = async (over: Record<string, unknown> = {}) => {
    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload(over))
      .expect(201);
    return res.body;
  };

  const approveExpense = async (id: string): Promise<void> => {
    await http()
      .post(API(`/expenses/${id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);
    await http()
      .post(API(`/expenses/${id}/approve`))
      .set(...admin2.header)
      .send({})
      .expect(201);
  };

  const createBudget = (body: Record<string, unknown>) =>
    http()
      .post(API('/budgets'))
      .set(...admin.header)
      .send({ effectiveFrom: monthStart(), ...body });

  const branchBudget = (amount: string) =>
    createBudget({
      scope: 'BRANCH',
      scopeId: alfa.branchIds[0],
      amount,
    });

  beforeAll(async () => {
    const ctx = await createHttpApp();
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;
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

    const category = await prisma.raw.category.create({
      data: { companyId: alfa.companyId, nameUz: 'Ofis', nameRu: 'Офис' },
    });
    categoryId = category.id;

    const employee = await prisma.raw.employee.findFirstOrThrow({
      where: { companyId: alfa.companyId, branchId: alfa.branchIds[0] },
    });
    employeeId = employee.id;
  });

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  it('limitni faqat bosh admin belgilaydi', async () => {
    await http()
      .post(API('/budgets'))
      .set(...director.header)
      .send({
        scope: 'BRANCH',
        scopeId: alfa.branchIds[0],
        amount: '1000000.00',
        effectiveFrom: monthStart(),
      })
      .expect(403);

    const created = await branchBudget('1000000.00').expect(201);
    expect(created.body.scope).toBe('BRANCH');
    expect(created.body.amount).toBe('1000000.00');
    expect(created.body.scopeName).toBe('Birinchi filial');
    expect(created.body.currency).toBe('UZS');
  });

  it('mavjud bo‘lmagan doiraga limit belgilanmaydi', async () => {
    const res = await createBudget({
      scope: 'BRANCH',
      scopeId: '00000000-0000-4000-8000-000000000000',
      amount: '1000000.00',
    }).expect(422);

    expect(res.body.code).toBe('SCOPE_NOT_FOUND');
  });

  it('ustma-ust tushadigan ikkinchi limit qabul qilinmaydi', async () => {
    await branchBudget('1000000.00').expect(201);

    const res = await branchBudget('2000000.00').expect(409);
    expect(res.body.code).toBe('BUDGET_OVERLAP');
  });

  it('muddati tugagan limitdan keyin yangisini belgilash mumkin', async () => {
    await createBudget({
      scope: 'BRANCH',
      scopeId: alfa.branchIds[0],
      amount: '1000000.00',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-06-30',
    }).expect(201);

    await createBudget({
      scope: 'BRANCH',
      scopeId: alfa.branchIds[0],
      amount: '2000000.00',
      effectiveFrom: '2026-07-01',
    }).expect(201);
  });

  it('tugash sanasi boshlanishdan oldin bo‘lsa 422', async () => {
    const res = await createBudget({
      scope: 'BRANCH',
      scopeId: alfa.branchIds[0],
      amount: '1000000.00',
      effectiveFrom: '2026-07-01',
      effectiveTo: '2026-06-01',
    }).expect(422);

    expect(res.body.code).toBe('INVALID_DATE_RANGE');
  });

  it('limit tahrirlanadi va o‘chiriladi', async () => {
    const created = await branchBudget('1000000.00').expect(201);

    const updated = await http()
      .patch(API(`/budgets/${created.body.id}`))
      .set(...admin.header)
      .send({ amount: '1500000.00' })
      .expect(200);
    expect(updated.body.amount).toBe('1500000.00');

    await http()
      .delete(API(`/budgets/${created.body.id}`))
      .set(...admin.header)
      .expect(204);

    await http()
      .get(API(`/budgets/${created.body.id}`))
      .set(...admin.header)
      .expect(404);
  });

  // ─── Yumshoq limit ─────────────────────────────────────────────────────────

  it('limitdan oshsa ham xarajat yaratiladi, javobda budgetWarning qaytadi', async () => {
    await branchBudget('50000.00').expect(201);

    const created = await createExpense({ amount: '100000.00' });

    expect(created.budgetWarning).toBeDefined();
    expect(created.budgetWarning[0].threshold).toBe(100);
    expect(created.budgetWarning[0].limit).toBe('50000.00');
    expect(created.budgetWarning[0].projected).toBe('100000.00');
    expect(created.budgetWarning[0].usedPercent).toBe(200);
  });

  it('80% chegarasi ogohlantiradi, 79% da ogohlantirish yo‘q', async () => {
    await branchBudget('1000000.00').expect(201);

    const under = await createExpense({ amount: '790000.00' });
    expect(under.budgetWarning).toBeUndefined();

    const over = await createExpense({ amount: '800000.00' });
    expect(over.budgetWarning[0].threshold).toBe(80);
  });

  it('limit belgilanmagan filial uchun ogohlantirish yo‘q', async () => {
    const created = await createExpense({ amount: '10000000.00' });
    expect(created.budgetWarning).toBeUndefined();
  });

  it('kategoriya va xodim limitlari ham baholanadi', async () => {
    await createBudget({
      scope: 'CATEGORY',
      scopeId: categoryId,
      amount: '50000.00',
    }).expect(201);
    await createBudget({
      scope: 'EMPLOYEE',
      scopeId: employeeId,
      amount: '40000.00',
    }).expect(201);

    const created = await createExpense({ amount: '100000.00' });

    const scopes = (created.budgetWarning as { scope: string }[])
      .map((w) => w.scope)
      .sort();
    expect(scopes).toEqual(['CATEGORY', 'EMPLOYEE']);
  });

  // ─── Bildirishnoma ─────────────────────────────────────────────────────────

  it('sarf 80% ga yetganda bir marta bildirishnoma boradi', async () => {
    await branchBudget('1000000.00').expect(201);

    const first = await createExpense({ amount: '800000.00' });
    // Yaratishda bildirishnoma yuborilmaydi — sarf hali o'zgarmagan
    let alerts = await prisma.raw.budgetAlert.findMany({
      where: { companyId: alfa.companyId },
    });
    expect(alerts).toHaveLength(0);

    await approveExpense(first.id as string);

    alerts = await prisma.raw.budgetAlert.findMany({
      where: { companyId: alfa.companyId },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].threshold).toBe(80);

    const notifications = await prisma.raw.notification.findMany({
      where: { companyId: alfa.companyId, type: 'BUDGET_THRESHOLD' },
    });
    // Ikki bosh admin + filial direktori
    expect(notifications).toHaveLength(3);

    // Keyingi xarajat 80% ni yana kesib o'tsa ham takroriy xabar yo'q
    const second = await createExpense({ amount: '50000.00' });
    await approveExpense(second.id as string);

    const after = await prisma.raw.budgetAlert.findMany({
      where: { companyId: alfa.companyId, threshold: 80 },
    });
    expect(after).toHaveLength(1);
  });

  it('80% dan keyin 100% alohida bildirishnoma beradi', async () => {
    await branchBudget('1000000.00').expect(201);

    const first = await createExpense({ amount: '850000.00' });
    await approveExpense(first.id as string);

    const second = await createExpense({ amount: '200000.00' });
    await approveExpense(second.id as string);

    const alerts = await prisma.raw.budgetAlert.findMany({
      where: { companyId: alfa.companyId },
      orderBy: { threshold: 'asc' },
    });
    expect(alerts.map((a) => a.threshold)).toEqual([80, 100]);
  });

  it('tahrirlash chegaradan o‘tkazsa ogohlantirish yuboriladi (TZ 3.8)', async () => {
    await branchBudget('1000000.00').expect(201);

    const expense = await createExpense({ amount: '500000.00' });
    await approveExpense(expense.id as string);

    // 50% — hali chegara yo'q
    expect(
      await prisma.raw.budgetAlert.count({
        where: { companyId: alfa.companyId },
      }),
    ).toBe(0);

    await http()
      .patch(API(`/expenses/${expense.id}`))
      .set(...admin.header)
      .send({
        reason: 'Chek summasi noto‘g‘ri kiritilgan edi',
        amount: '900000.00',
      })
      .expect(200);

    const alerts = await prisma.raw.budgetAlert.findMany({
      where: { companyId: alfa.companyId },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].threshold).toBe(80);

    const usage = await http()
      .get(API('/budgets/usage'))
      .set(...admin.header)
      .expect(200);
    expect(usage.body[0].spent).toBe('900000.00');
  });

  // ─── Sarf hisobi ───────────────────────────────────────────────────────────

  it('faqat tasdiqlangan xarajat sarfga kiradi', async () => {
    await branchBudget('1000000.00').expect(201);

    const pending = await createExpense({ amount: '300000.00' });

    let usage = await http()
      .get(API('/budgets/usage'))
      .set(...admin.header)
      .expect(200);
    expect(usage.body[0].spent).toBe('0.00');

    await approveExpense(pending.id as string);

    usage = await http()
      .get(API('/budgets/usage'))
      .set(...admin.header)
      .expect(200);
    expect(usage.body[0].spent).toBe('300000.00');
    expect(usage.body[0].remaining).toBe('700000.00');
    expect(usage.body[0].usedPercent).toBe(30);
    expect(usage.body[0].periodStart).toBe(monthStart());
  });

  it('qaytarish tasdiqlangach sarf kamayadi (effektiv summa)', async () => {
    await branchBudget('1000000.00').expect(201);

    const expense = await createExpense({ amount: '500000.00' });
    await approveExpense(expense.id as string);

    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 7),
    ]);

    const refund = await http()
      .post(API('/refunds'))
      .set(...admin.header)
      .field('expenseId', expense.id as string)
      .field('amount', '200000.00')
      .field('reason', 'Tovar qaytarildi, pul qaytdi')
      .attach('files', png, { filename: 'k.png', contentType: 'image/png' })
      .expect(201);

    await http()
      .post(API(`/refunds/${refund.body.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);
    await http()
      .post(API(`/refunds/${refund.body.id}/approve`))
      .set(...admin2.header)
      .send({})
      .expect(201);

    const usage = await http()
      .get(API('/budgets/usage'))
      .set(...admin.header)
      .expect(200);

    expect(usage.body[0].spent).toBe('300000.00');
    expect(usage.body[0].usedPercent).toBe(30);
  });

  it('xodim limitida faqat o‘sha xodimning ulushi hisoblanadi', async () => {
    await createBudget({
      scope: 'EMPLOYEE',
      scopeId: employeeId,
      amount: '1000000.00',
    }).expect(201);

    const employees = await prisma.raw.employee.findMany({
      where: { companyId: alfa.companyId, branchId: alfa.branchIds[0] },
      orderBy: { fullName: 'asc' },
      take: 2,
    });

    const expense = await createExpense({
      amount: '400000.00',
      employeeIds: employees.map((e) => e.id),
    });
    await approveExpense(expense.id as string);

    const usage = await http()
      .get(API('/budgets/usage'))
      .query({ scope: 'EMPLOYEE' })
      .set(...admin.header)
      .expect(200);

    const own = (usage.body as { scopeId: string; spent: string }[]).find(
      (u) => u.scopeId === employeeId,
    );
    expect(own?.spent).toBe('200000.00');
  });

  it('o‘chirilgan xarajat sarfga kirmaydi', async () => {
    await branchBudget('1000000.00').expect(201);

    const expense = await createExpense({ amount: '300000.00' });
    await http()
      .delete(API(`/expenses/${expense.id}`))
      .set(...admin.header)
      .expect(204);

    const usage = await http()
      .get(API('/budgets/usage'))
      .set(...admin.header)
      .expect(200);
    expect(usage.body[0].spent).toBe('0.00');
  });

  it('boshqa davrdagi xarajat joriy davr sarfiga kirmaydi', async () => {
    await createBudget({
      scope: 'BRANCH',
      scopeId: alfa.branchIds[0],
      amount: '1000000.00',
      effectiveFrom: '2026-01-01',
    }).expect(201);

    const old = await createExpense({
      amount: '300000.00',
      date: '2026-01-15',
    });
    await approveExpense(old.id as string);

    const usage = await http()
      .get(API('/budgets/usage'))
      .set(...admin.header)
      .expect(200);
    expect(usage.body[0].spent).toBe('0.00');

    const january = await http()
      .get(API('/budgets/usage'))
      .query({ on: '2026-01-20' })
      .set(...admin.header)
      .expect(200);
    expect(january.body[0].spent).toBe('300000.00');
    expect(january.body[0].periodKey).toBe('2026-01');
  });

  it('boshqa kompaniyaning limiti ko‘rinmaydi', async () => {
    const created = await branchBudget('1000000.00').expect(201);

    const beta = await seedCompany(prisma, 'beta', 'beta.uz');
    const betaAdmin = await loginAs(app, beta.adminEmail);

    await http()
      .get(API(`/budgets/${created.body.id}`))
      .set(...betaAdmin.header)
      .expect(404);

    const list = await http()
      .get(API('/budgets'))
      .set(...betaAdmin.header)
      .expect(200);
    expect(list.body.total).toBe(0);
  });
});
