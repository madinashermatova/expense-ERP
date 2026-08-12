import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

const REASON = 'Kompyuter qaytarildi, do‘kon pulni qaytardi';

/** Haqiqiy PNG magic-byte — `FilesService` mazmunga qarab tekshiradi (TZ 4.2) */
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);

describe('Qaytarish (TZ 3.9)', () => {
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

  const payload = (over: Record<string, unknown> = {}) => ({
    branchId: alfa.branchIds[0],
    categoryId,
    employeeIds: [employeeId],
    amount: '500000.00',
    currency: 'UZS',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'CASH',
    ...over,
  });

  const createExpense = async (
    over: Record<string, unknown> = {},
  ): Promise<string> => {
    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload(over))
      .expect(201);
    return res.body.id as string;
  };

  /** Xarajatni ikki bosqichdan o'tkazib APPROVED holatga keltiradi */
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

  const createRefund = (expenseId: string, amount: string, session = admin) =>
    http()
      .post(API('/refunds'))
      .set(...session.header)
      .field('expenseId', expenseId)
      .field('amount', amount)
      .field('reason', REASON)
      .attach('files', png, {
        filename: 'kvitansiya.png',
        contentType: 'image/png',
      });

  /** Qaytarishni ikki bosqichdan o'tkazadi */
  const approveRefund = async (id: string): Promise<void> => {
    await http()
      .post(API(`/refunds/${id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);
    await http()
      .post(API(`/refunds/${id}/approve`))
      .set(...admin2.header)
      .send({})
      .expect(201);
  };

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
      data: { companyId: alfa.companyId, nameUz: 'Texnika', nameRu: 'Техника' },
    });
    categoryId = category.id;

    const employee = await prisma.raw.employee.findFirstOrThrow({
      where: { companyId: alfa.companyId, branchId: alfa.branchIds[0] },
    });
    employeeId = employee.id;
  });

  // ─── Yaratish qoidalari ────────────────────────────────────────────────────

  it('tasdiqlanmagan xarajatga qaytarish yaratib bo‘lmaydi', async () => {
    const expenseId = await createExpense();

    const res = await createRefund(expenseId, '100000.00').expect(422);
    expect(res.body.code).toBe('EXPENSE_NOT_REFUNDABLE');
  });

  it('isbot faylsiz qaytarish 422 qaytaradi', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);

    const res = await http()
      .post(API('/refunds'))
      .set(...admin.header)
      .field('expenseId', expenseId)
      .field('amount', '100000.00')
      .field('reason', REASON)
      .expect(422);

    expect(res.body.code).toBe('REFUND_PROOF_REQUIRED');
    expect(res.body.message).toBe('Qaytarish uchun isbot majburiy');
  });

  it('qolgan summadan katta qaytarish 422 qaytaradi', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);

    const res = await createRefund(expenseId, '500000.01').expect(422);
    expect(res.body.code).toBe('REFUND_EXCEEDS_REMAINING');
  });

  it('qisqa sabab bilan qaytarish 422', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);

    await http()
      .post(API('/refunds'))
      .set(...admin.header)
      .field('expenseId', expenseId)
      .field('amount', '100000.00')
      .field('reason', 'yoq')
      .attach('files', png, { filename: 'k.png', contentType: 'image/png' })
      .expect(422);
  });

  it('navbatdagi so‘rovlar ham qolgan summadan chegiriladi', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);

    await createRefund(expenseId, '400000.00').expect(201);

    // 400 000 hali tasdiqlanmagan, lekin navbatda — qolgani 100 000
    const res = await createRefund(expenseId, '200000.00').expect(422);
    expect(res.body.code).toBe('REFUND_EXCEEDS_REMAINING');

    await createRefund(expenseId, '100000.00').expect(201);
  });

  // ─── Ikki bosqichli tasdiqlash ─────────────────────────────────────────────

  it('direktor tasdig‘idan keyin ADMIN_PENDING bo‘ladi, APPROVED emas', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    const refund = await createRefund(expenseId, '200000.00').expect(201);

    const afterDirector = await http()
      .post(API(`/refunds/${refund.body.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    expect(afterDirector.body.status).toBe('ADMIN_PENDING');

    const expense = await prisma.raw.expense.findUniqueOrThrow({
      where: { id: expenseId },
    });
    expect(expense.status).toBe('APPROVED');
    expect(expense.refundedAmount.toString()).toBe('0');
  });

  it('ikkinchi bosqichni direktor hal qila olmaydi', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    const refund = await createRefund(expenseId, '200000.00').expect(201);

    await http()
      .post(API(`/refunds/${refund.body.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    const res = await http()
      .post(API(`/refunds/${refund.body.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(403);

    expect(res.body.code).toBe('STAGE_FORBIDDEN');
  });

  it('ikki admin bir vaqtda tasdiqlasa, biri 409 oladi', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    const refund = await createRefund(expenseId, '200000.00').expect(201);

    await http()
      .post(API(`/refunds/${refund.body.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    const [first, second] = await Promise.all([
      http()
        .post(API(`/refunds/${refund.body.id}/approve`))
        .set(...admin2.header)
        .send({}),
      http()
        .post(API(`/refunds/${refund.body.id}/approve`))
        .set(...admin2.header)
        .send({}),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
  });

  // ─── Qisman va to'liq qaytarish ────────────────────────────────────────────

  it('qisman qaytarish: 500 000 dan 200 000 → PARTIALLY_REFUNDED, effektiv 300 000', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    const refund = await createRefund(expenseId, '200000.00').expect(201);

    await approveRefund(refund.body.id as string);

    const expense = await http()
      .get(API(`/expenses/${expenseId}`))
      .set(...admin.header)
      .expect(200);

    expect(expense.body.status).toBe('PARTIALLY_REFUNDED');
    expect(expense.body.refundedAmount).toBe('200000.00');
    expect(expense.body.effectiveAmount).toBe('300000.00');
  });

  it('to‘liq qaytarish: xarajat REFUNDED, effektiv summa 0', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    const refund = await createRefund(expenseId, '500000.00').expect(201);

    await approveRefund(refund.body.id as string);

    const expense = await http()
      .get(API(`/expenses/${expenseId}`))
      .set(...admin.header)
      .expect(200);

    expect(expense.body.status).toBe('REFUNDED');
    expect(expense.body.effectiveAmount).toBe('0.00');
  });

  it('ikki qisman qaytarish yig‘indisi to‘liq summaga yetganda REFUNDED', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);

    const first = await createRefund(expenseId, '200000.00').expect(201);
    const second = await createRefund(expenseId, '300000.00').expect(201);

    await approveRefund(first.body.id as string);
    let expense = await prisma.raw.expense.findUniqueOrThrow({
      where: { id: expenseId },
    });
    expect(expense.status).toBe('PARTIALLY_REFUNDED');

    await approveRefund(second.body.id as string);
    expense = await prisma.raw.expense.findUniqueOrThrow({
      where: { id: expenseId },
    });
    expect(expense.status).toBe('REFUNDED');
    expect(expense.refundedAmount.toString()).toBe('500000');
  });

  it('qaytarish kursni asl xarajatdan meros oladi', async () => {
    await prisma.raw.currencyRate.create({
      data: {
        companyId: alfa.companyId,
        date: new Date(
          `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
        ),
        currency: 'USD',
        rate: '12500.000000',
        source: 'AUTO',
      },
    });

    const expenseId = await createExpense({
      currency: 'USD',
      amount: '100.00',
    });
    await approveExpense(expenseId);

    const refund = await createRefund(expenseId, '40.00').expect(201);

    expect(refund.body.currency).toBe('USD');
    expect(refund.body.rateUsed).toBe('12500.000000');
    expect(refund.body.amountUzs).toBe('500000.00');
  });

  // ─── Rad etish ─────────────────────────────────────────────────────────────

  it('rad etilgan qaytarish xarajatga ta’sir qilmaydi', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    const refund = await createRefund(expenseId, '200000.00').expect(201);

    const rejected = await http()
      .post(API(`/refunds/${refund.body.id}/reject`))
      .set(...director.header)
      .send({ reason: REASON })
      .expect(201);

    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.rejectReason).toBe(REASON);

    const expense = await prisma.raw.expense.findUniqueOrThrow({
      where: { id: expenseId },
    });
    expect(expense.status).toBe('APPROVED');
    expect(expense.refundedAmount.toString()).toBe('0');

    // Rad etilgan so'rov qolgan summani band qilmaydi
    await createRefund(expenseId, '500000.00').expect(201);
  });

  it('qisqa sabab bilan rad etish 422', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    const refund = await createRefund(expenseId, '200000.00').expect(201);

    await http()
      .post(API(`/refunds/${refund.body.id}/reject`))
      .set(...director.header)
      .send({ reason: 'yoq' })
      .expect(422);
  });

  // ─── Ro'yxat, doira va audit ───────────────────────────────────────────────

  it('ro‘yxat isbot fayllari bilan qaytadi va PENDING filtri ishlaydi', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    await createRefund(expenseId, '100000.00').expect(201);

    const list = await http()
      .get(API('/refunds'))
      .query({ status: 'PENDING' })
      .set(...admin.header)
      .expect(200);

    expect(list.body.total).toBe(1);
    expect(list.body.items[0].expenseGlobalNumber).toBe('EXP-000001');
    expect(list.body.items[0].files).toHaveLength(1);
    expect(list.body.items[0].files[0].originalName).toBe('kvitansiya.png');
  });

  it('direktor faqat o‘z filiali qaytarishlarini ko‘radi', async () => {
    const other = await prisma.raw.employee.create({
      data: {
        companyId: alfa.companyId,
        fullName: 'Ikkinchi',
        branchId: alfa.branchIds[1],
      },
    });
    const foreignExpense = await createExpense({
      branchId: alfa.branchIds[1],
      employeeIds: [other.id],
    });
    await http()
      .post(API(`/expenses/${foreignExpense}/approve`))
      .set(...admin.header)
      .send({})
      .expect(201);
    await http()
      .post(API(`/expenses/${foreignExpense}/approve`))
      .set(...admin2.header)
      .send({})
      .expect(201);

    const refund = await createRefund(foreignExpense, '100000.00').expect(201);

    const list = await http()
      .get(API('/refunds'))
      .set(...director.header)
      .expect(200);
    expect(list.body.total).toBe(0);

    await http()
      .get(API(`/refunds/${refund.body.id}`))
      .set(...director.header)
      .expect(404);
  });

  it('boshqa kompaniyaning qaytarishi ko‘rinmaydi', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    const refund = await createRefund(expenseId, '100000.00').expect(201);

    const beta = await seedCompany(prisma, 'beta', 'beta.uz');
    const betaAdmin = await loginAs(app, beta.adminEmail);

    await http()
      .get(API(`/refunds/${refund.body.id}`))
      .set(...betaAdmin.header)
      .expect(404);
  });

  it('qaytarish audit jurnaliga eski va yangi status bilan tushadi', async () => {
    const expenseId = await createExpense();
    await approveExpense(expenseId);
    const refund = await createRefund(expenseId, '500000.00').expect(201);
    await approveRefund(refund.body.id as string);

    const audit = await prisma.raw.auditLog.findFirstOrThrow({
      where: { entityId: expenseId, action: 'expense.refunded' },
    });

    const changes = JSON.stringify(audit.changes);
    expect(changes).toContain('APPROVED');
    expect(changes).toContain('REFUNDED');
    expect(changes).toContain('500000.00');
  });
});
