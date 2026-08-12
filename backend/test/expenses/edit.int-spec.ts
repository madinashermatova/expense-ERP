import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

const REASON = 'Chek summasi noto‘g‘ri kiritilgan edi';

describe('Tahrirlash va murojaatlar (TZ 3.8)', () => {
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
    amount: '150000.00',
    currency: 'UZS',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'CASH',
    ...over,
  });

  const createExpense = async (
    over: Record<string, unknown> = {},
  ): Promise<{ id: string; version: number }> => {
    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload(over))
      .expect(201);
    return res.body;
  };

  /** Ikki bosqichdan o'tkazib APPROVED holatga keltiradi */
  const approve = async (id: string): Promise<void> => {
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

  // ─── Tahrirlash oynasi ─────────────────────────────────────────────────────

  it('tasdiqlangan xarajat 24 soat ichida tahrirlanadi', async () => {
    const created = await createExpense();
    await approve(created.id);

    const res = await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ reason: REASON, amount: '175000.00' })
      .expect(200);

    expect(res.body.amount).toBe('175000.00');
    expect(res.body.amountUzs).toBe('175000.00');
    expect(res.body.shares[0].amount).toBe('175000.00');
    // Raqamlar hech qachon o'zgarmaydi (TZ 3.6)
    expect(res.body.globalNumber).toBe('EXP-000001');
  });

  it('24 soat 1 daqiqa o‘tgach tahrirlash bloklanadi', async () => {
    const created = await createExpense();
    await approve(created.id);

    await prisma.raw.expense.update({
      where: { id: created.id },
      data: {
        approvedAt: new Date(Date.now() - (24 * 60 + 1) * 60_000),
      },
    });

    const res = await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ reason: REASON, amount: '175000.00' })
      .expect(422);

    expect(res.body.code).toBe('EDIT_WINDOW_CLOSED');
    expect(res.body.message).toContain('Tahrirlash muddati tugagan');
  });

  it('sababsiz yoki qisqa sabab bilan tahrirlash 422', async () => {
    const created = await createExpense();

    await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ amount: '175000.00' })
      .expect(422);

    await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ reason: 'qisqa', amount: '175000.00' })
      .expect(422);
  });

  it('audit jurnalida eski va yangi summa ikkalasi ham bo‘ladi', async () => {
    const created = await createExpense();
    await approve(created.id);

    await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ reason: REASON, amount: '175000.00' })
      .expect(200);

    const audit = await prisma.raw.auditLog.findFirstOrThrow({
      where: { entityId: created.id, action: 'expense.update' },
    });

    const changes = JSON.stringify(audit.changes);
    expect(changes).toContain('150000.00');
    expect(changes).toContain('175000.00');
    expect(changes).toContain(REASON);
  });

  it('tahrirlash status tarixida sabab bilan iz qoldiradi', async () => {
    const created = await createExpense();

    await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ reason: REASON, comment: 'Tuzatildi' })
      .expect(200);

    const history = await prisma.raw.expenseStatusHistory.findMany({
      where: { expenseId: created.id },
      orderBy: { createdAt: 'asc' },
    });

    const edit = history.at(-1);
    expect(edit?.fromStatus).toBe(edit?.toStatus);
    expect(edit?.reason).toBe(REASON);
  });

  it('ADMIN_PENDING tahrirlanmaydi — request-fix ishlatiladi', async () => {
    const created = await createExpense();
    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    const res = await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ reason: REASON, amount: '175000.00' })
      .expect(422);

    expect(res.body.code).toBe('EXPENSE_NOT_EDITABLE');
  });

  it('rad etilgan xarajat tahrirlanmaydi', async () => {
    const created = await createExpense();
    await http()
      .post(API(`/expenses/${created.id}/reject`))
      .set(...director.header)
      .send({ reason: REASON })
      .expect(201);

    await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ reason: REASON, amount: '175000.00' })
      .expect(422);
  });

  it('sana o‘zgarsa kurs qayta hisoblanadi, summa o‘zgarsa eski kurs qoladi', async () => {
    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);

    for (const [date, rate] of [
      [yesterday, '12000.000000'],
      [new Date().toISOString().slice(0, 10), '12500.000000'],
    ]) {
      await prisma.raw.currencyRate.create({
        data: {
          companyId: alfa.companyId,
          date: new Date(`${date}T00:00:00.000Z`),
          currency: 'USD',
          rate,
          source: 'AUTO',
        },
      });
    }

    const created = await createExpense({ currency: 'USD', amount: '100.00' });

    // Faqat summa: kurs snapshot i saqlanadi
    const sameRate = await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ reason: REASON, amount: '200.00' })
      .expect(200);
    expect(sameRate.body.rateUsed).toBe('12500.000000');
    expect(sameRate.body.amountUzs).toBe('2500000.00');

    // Sana tuzatildi: kurs o'sha sanaga qayta olinadi
    const newRate = await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .send({ reason: REASON, date: yesterday })
      .expect(200);
    expect(newRate.body.rateUsed).toBe('12000.000000');
    expect(newRate.body.amountUzs).toBe('2400000.00');
  });

  it('direktor boshqa filial xarajatini tahrirlay olmaydi', async () => {
    const other = await prisma.raw.employee.create({
      data: {
        companyId: alfa.companyId,
        fullName: 'Ikkinchi',
        branchId: alfa.branchIds[1],
      },
    });
    const created = await createExpense({
      branchId: alfa.branchIds[1],
      employeeIds: [other.id],
    });

    await http()
      .patch(API(`/expenses/${created.id}`))
      .set(...director.header)
      .send({ reason: REASON, amount: '175000.00' })
      .expect(403);
  });

  // ─── Tahrirlash murojaatlari ───────────────────────────────────────────────

  it('murojaat yaratiladi va direktorga bildirishnoma boradi', async () => {
    const created = await createExpense();

    const res = await http()
      .post(API('/edit-requests'))
      .set(...admin.header)
      .send({ expenseId: created.id, description: REASON })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    expect(res.body.expenseGlobalNumber).toBe('EXP-000001');
    expect(res.body.description).toBe(REASON);

    const notifications = await prisma.raw.notification.findMany({
      where: {
        companyId: alfa.companyId,
        type: 'EDIT_REQUEST_SUBMITTED',
      },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe(alfa.directorId);

    const list = await http()
      .get(API('/edit-requests'))
      .query({ status: 'PENDING' })
      .set(...director.header)
      .expect(200);
    expect(list.body.total).toBe(1);
  });

  it('bitta xarajat bo‘yicha ikkinchi ochiq murojaat qabul qilinmaydi', async () => {
    const created = await createExpense();

    await http()
      .post(API('/edit-requests'))
      .set(...admin.header)
      .send({ expenseId: created.id, description: REASON })
      .expect(201);

    const res = await http()
      .post(API('/edit-requests'))
      .set(...admin.header)
      .send({ expenseId: created.id, description: REASON })
      .expect(409);

    expect(res.body.code).toBe('EDIT_REQUEST_PENDING');
  });

  it('apply murojaatni yopadi va berilgan o‘zgarishlarni qo‘llaydi', async () => {
    const created = await createExpense();
    const requestRes = await http()
      .post(API('/edit-requests'))
      .set(...admin.header)
      .send({ expenseId: created.id, description: REASON })
      .expect(201);

    const applied = await http()
      .post(API(`/edit-requests/${requestRes.body.id}/apply`))
      .set(...director.header)
      .send({ changes: { reason: REASON, amount: '99000.00' } })
      .expect(201);

    expect(applied.body.status).toBe('APPLIED');
    expect(applied.body.handledByUserId).toBe(alfa.directorId);

    const expense = await http()
      .get(API(`/expenses/${created.id}`))
      .set(...admin.header)
      .expect(200);
    expect(expense.body.amount).toBe('99000.00');
  });

  it('apply o‘zgarishsiz ham murojaatni yopadi', async () => {
    const created = await createExpense();
    const requestRes = await http()
      .post(API('/edit-requests'))
      .set(...admin.header)
      .send({ expenseId: created.id, description: REASON })
      .expect(201);

    const applied = await http()
      .post(API(`/edit-requests/${requestRes.body.id}/apply`))
      .set(...director.header)
      .send({})
      .expect(201);

    expect(applied.body.status).toBe('APPLIED');
  });

  it('rad etish sababi majburiy va murojaat qayta ko‘rilmaydi', async () => {
    const created = await createExpense();
    const requestRes = await http()
      .post(API('/edit-requests'))
      .set(...admin.header)
      .send({ expenseId: created.id, description: REASON })
      .expect(201);
    const id = requestRes.body.id as string;

    await http()
      .post(API(`/edit-requests/${id}/reject`))
      .set(...director.header)
      .send({ reason: 'yoq' })
      .expect(422);

    const rejected = await http()
      .post(API(`/edit-requests/${id}/reject`))
      .set(...director.header)
      .send({ reason: REASON })
      .expect(201);
    expect(rejected.body.status).toBe('REJECTED');
    expect(rejected.body.rejectReason).toBe(REASON);

    const again = await http()
      .post(API(`/edit-requests/${id}/apply`))
      .set(...director.header)
      .send({})
      .expect(409);
    expect(again.body.code).toBe('ALREADY_PROCESSED');
  });

  it('«hal qilingan» filtri APPLIED va REJECTED ni qaytaradi', async () => {
    const first = await createExpense();
    const second = await createExpense({ amount: '20000.00' });

    const ids: string[] = [];
    for (const expense of [first, second]) {
      const res = await http()
        .post(API('/edit-requests'))
        .set(...admin.header)
        .send({ expenseId: expense.id, description: REASON })
        .expect(201);
      ids.push(res.body.id as string);
    }

    await http()
      .post(API(`/edit-requests/${ids[0]}/apply`))
      .set(...director.header)
      .send({})
      .expect(201);
    await http()
      .post(API(`/edit-requests/${ids[1]}/reject`))
      .set(...director.header)
      .send({ reason: REASON })
      .expect(201);

    const resolved = await http()
      .get(API('/edit-requests'))
      .query({ status: 'RESOLVED' })
      .set(...admin.header)
      .expect(200);
    expect(resolved.body.total).toBe(2);

    const pending = await http()
      .get(API('/edit-requests'))
      .query({ status: 'PENDING' })
      .set(...admin.header)
      .expect(200);
    expect(pending.body.total).toBe(0);
  });

  it('boshqa kompaniyaning murojaati ko‘rinmaydi', async () => {
    const created = await createExpense();
    const requestRes = await http()
      .post(API('/edit-requests'))
      .set(...admin.header)
      .send({ expenseId: created.id, description: REASON })
      .expect(201);

    const beta = await seedCompany(prisma, 'beta', 'beta.uz');
    const betaAdmin = await loginAs(app, beta.adminEmail);

    await http()
      .get(API(`/edit-requests/${requestRes.body.id}`))
      .set(...betaAdmin.header)
      .expect(404);

    const list = await http()
      .get(API('/edit-requests'))
      .set(...betaAdmin.header)
      .expect(200);
    expect(list.body.total).toBe(0);
  });
});
