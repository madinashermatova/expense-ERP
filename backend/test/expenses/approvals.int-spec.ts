import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { ApprovalReminderCron } from '../../src/modules/expenses/approval-reminder.cron';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

const LONG_REASON = 'Chek nusxasi o‘qilmayapti, qayta yuboring';

describe('Tasdiqlash oqimi (TZ 3.7)', () => {
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

  /** Xarajat yaratadi va id sini qaytaradi */
  const createBy = async (
    session: Session,
    over: Record<string, unknown> = {},
  ): Promise<{ id: string; status: string; version: number }> => {
    const res = await http()
      .post(API('/expenses'))
      .set(...session.header)
      .send(payload(over))
      .expect(201);
    return res.body;
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

  // ─── Ikki bosqich ──────────────────────────────────────────────────────────

  it('direktor tasdiqlagach ADMIN_PENDING bo‘ladi, APPROVED emas', async () => {
    const created = await createBy(admin);
    expect(created.status).toBe('DIRECTOR_PENDING');

    const approved = await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    expect(approved.body.status).toBe('ADMIN_PENDING');
  });

  it('bosh admin ikkinchi bosqichda APPROVED qiladi', async () => {
    const created = await createBy(admin);

    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    const final = await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...admin2.header)
      .send({})
      .expect(201);

    expect(final.body.status).toBe('APPROVED');

    const row = await prisma.raw.expense.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.approvedAt).not.toBeNull();
    expect(row.directorApprovedByUserId).toBe(alfa.directorId);
    expect(row.adminApprovedByUserId).toBe(alfa.admin2Id);
    expect(row.selfApproved).toBe(false);
  });

  it('ADMIN_PENDING ni direktor tasdiqlashga urinsa 403', async () => {
    const created = await createBy(admin);

    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    const res = await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(403);

    expect(res.body.code).toBe('STAGE_FORBIDDEN');
  });

  it('direktor kiritgan xarajat darhol ADMIN_PENDING bo‘ladi', async () => {
    const created = await createBy(director);
    expect(created.status).toBe('ADMIN_PENDING');
  });

  // ─── Four-eyes ─────────────────────────────────────────────────────────────

  it('bosh admin o‘zinikini tasdiqlay olmaydi — boshqa admin bor', async () => {
    const created = await createBy(admin);

    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    const res = await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...admin.header)
      .send({})
      .expect(403);

    expect(res.body.code).toBe('SELF_APPROVAL_FORBIDDEN');
  });

  it('yagona faol admin o‘zinikini tasdiqlaydi, selfApproved = true', async () => {
    const created = await createBy(admin);

    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    await prisma.raw.user.update({
      where: { id: alfa.admin2Id },
      data: { isActive: false },
    });

    const final = await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...admin.header)
      .send({})
      .expect(201);

    expect(final.body.status).toBe('APPROVED');

    const row = await prisma.raw.expense.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.selfApproved).toBe(true);

    const audit = await prisma.raw.auditLog.findFirst({
      where: { entityId: created.id, action: 'expense.approve' },
      orderBy: { createdAt: 'desc' },
    });
    expect(JSON.stringify(audit?.changes)).toContain('selfApproved');
  });

  // ─── Optimistik blokirovka ─────────────────────────────────────────────────

  it('ikki admin bir vaqtda tasdiqlasa, biri 409 oladi', async () => {
    const created = await createBy(admin);

    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    const [first, second] = await Promise.all([
      http()
        .post(API(`/expenses/${created.id}/approve`))
        .set(...admin2.header)
        .send({}),
      http()
        .post(API(`/expenses/${created.id}/approve`))
        .set(...admin2.header)
        .send({}),
    ]);

    const codes = [first.status, second.status].sort();
    expect(codes).toEqual([201, 409]);

    const conflict = first.status === 409 ? first : second;
    expect(conflict.body.code).toBe('ALREADY_PROCESSED');
  });

  it('eskirgan version bilan tasdiqlash 409 qaytaradi', async () => {
    const created = await createBy(admin);
    const staleVersion = created.version;

    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    const res = await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...admin2.header)
      .send({ version: staleVersion })
      .expect(409);

    expect(res.body.code).toBe('ALREADY_PROCESSED');
  });

  // ─── Rad etish va tuzatish ─────────────────────────────────────────────────

  it('qisqa sabab bilan rad etish 422', async () => {
    const created = await createBy(admin);

    await http()
      .post(API(`/expenses/${created.id}/reject`))
      .set(...director.header)
      .send({ reason: 'yoq' })
      .expect(422);
  });

  it('rad etilgan xarajat REJECTED bo‘ladi va sabab tarixda qoladi', async () => {
    const created = await createBy(admin);

    const res = await http()
      .post(API(`/expenses/${created.id}/reject`))
      .set(...director.header)
      .send({ reason: LONG_REASON })
      .expect(201);

    expect(res.body.status).toBe('REJECTED');

    const history = await prisma.raw.expenseStatusHistory.findMany({
      where: { expenseId: created.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(history).toHaveLength(2);
    expect(history[1].toStatus).toBe('REJECTED');
    expect(history[1].reason).toBe(LONG_REASON);
    expect(history[1].byUserId).toBe(alfa.directorId);
  });

  it('tuzatishdan keyin qayta yuborilsa oqim 1-bosqichdan boshlanadi', async () => {
    const created = await createBy(admin);

    const fix = await http()
      .post(API(`/expenses/${created.id}/request-fix`))
      .set(...director.header)
      .send({ reason: LONG_REASON })
      .expect(201);
    expect(fix.body.status).toBe('NEEDS_FIX');

    const resubmitted = await http()
      .post(API(`/expenses/${created.id}/submit`))
      .set(...admin.header)
      .expect(201);

    expect(resubmitted.body.status).toBe('DIRECTOR_PENDING');

    const row = await prisma.raw.expense.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.directorApprovedByUserId).toBeNull();
    expect(row.approvedAt).toBeNull();
  });

  it('APPROVED xarajatni qayta tasdiqlab bo‘lmaydi', async () => {
    const created = await createBy(admin);

    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);
    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...admin2.header)
      .send({})
      .expect(201);

    const res = await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...admin2.header)
      .send({})
      .expect(422);

    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  // ─── Bekor qilish ──────────────────────────────────────────────────────────

  it('faqat kiritgan shaxs bekor qila oladi', async () => {
    const created = await createBy(admin);

    const foreign = await http()
      .post(API(`/expenses/${created.id}/cancel`))
      .set(...admin2.header)
      .expect(403);
    expect(foreign.body.code).toBe('NOT_EXPENSE_OWNER');

    const own = await http()
      .post(API(`/expenses/${created.id}/cancel`))
      .set(...admin.header)
      .expect(201);
    expect(own.body.status).toBe('CANCELLED');
  });

  // ─── Bulk ──────────────────────────────────────────────────────────────────

  it('bulk-tasdiqlash qisman muvaffaqiyat hisobotini qaytaradi', async () => {
    const first = await createBy(admin);
    const second = await createBy(admin, { amount: '20000.00' });
    const third = await createBy(admin, { amount: '30000.00' });

    // Birinchi ikkitasi 1-bosqichdan o'tkaziladi, uchinchisi navbatda qoladi
    for (const id of [first.id, second.id]) {
      await http()
        .post(API(`/expenses/${id}/approve`))
        .set(...director.header)
        .send({})
        .expect(201);
    }

    const res = await http()
      .post(API('/expenses/bulk-approve'))
      .set(...admin2.header)
      .send({ ids: [first.id, second.id, third.id] })
      .expect(201);

    expect(res.body.approved.sort()).toEqual(
      [first.id, second.id, third.id].sort(),
    );
    expect(res.body.failed).toHaveLength(0);

    // Ikkalasi 2-bosqichdan o'tdi, uchinchisi esa endi 1-bosqichdan —
    // bosh admin direktor bosqichini ham hal qila oladi (TZ 3.7 jadvali)
    const rows = await prisma.raw.expense.findMany({
      where: { id: { in: [first.id, second.id, third.id] } },
    });
    const byId = new Map(rows.map((r) => [r.id, r.status]));
    expect(byId.get(first.id)).toBe('APPROVED');
    expect(byId.get(second.id)).toBe('APPROVED');
    expect(byId.get(third.id)).toBe('ADMIN_PENDING');
  });

  it('bulk da yiqilgan ariza qolganlarini to‘xtatmaydi', async () => {
    const ok = await createBy(admin);
    const cancelled = await createBy(admin, { amount: '20000.00' });

    await http()
      .post(API(`/expenses/${ok.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);
    await http()
      .post(API(`/expenses/${cancelled.id}/cancel`))
      .set(...admin.header)
      .expect(201);

    const res = await http()
      .post(API('/expenses/bulk-approve'))
      .set(...admin2.header)
      .send({ ids: [ok.id, cancelled.id] })
      .expect(201);

    expect(res.body.approved).toEqual([ok.id]);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].id).toBe(cancelled.id);
    expect(res.body.failed[0].code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('bulk 20 tadan ortiq ariza qabul qilmaydi', async () => {
    const ids = Array.from(
      { length: 21 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );

    await http()
      .post(API('/expenses/bulk-approve'))
      .set(...admin.header)
      .send({ ids })
      .expect(422);
  });

  // ─── Tenant va filial doirasi ──────────────────────────────────────────────

  it('boshqa kompaniya arizasini tasdiqlab bo‘lmaydi', async () => {
    const created = await createBy(admin);

    const beta = await seedCompany(prisma, 'beta', 'beta.uz');
    const betaAdmin = await loginAs(app, beta.adminEmail);

    await http()
      .post(API(`/expenses/${created.id}/approve`))
      .set(...betaAdmin.header)
      .send({})
      .expect(404);
  });

  // ─── Eslatma croni ─────────────────────────────────────────────────────────

  it('24 soatdan ortiq kutgan ariza bo‘yicha eslatma yuboriladi va takrorlanmaydi', async () => {
    const created = await createBy(admin);

    await prisma.raw.expense.update({
      where: { id: created.id },
      data: { createdAt: new Date(Date.now() - 30 * 3_600_000) },
    });

    const cron = app.get(ApprovalReminderCron);

    const first = await cron.run(new Date());
    expect(first.reminded).toBe(1);

    const notifications = await prisma.raw.notification.findMany({
      where: { companyId: alfa.companyId, type: 'APPROVAL_REMINDER' },
    });
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.every((n) => n.userId === alfa.directorId)).toBe(true);

    const second = await cron.run(new Date());
    expect(second.reminded).toBe(0);
  });

  it('yangi ariza bo‘yicha eslatma yuborilmaydi', async () => {
    await createBy(admin);

    const cron = app.get(ApprovalReminderCron);
    const result = await cron.run(new Date());

    expect(result.reminded).toBe(0);
  });
});
