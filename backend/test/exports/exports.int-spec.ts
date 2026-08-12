import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { ExportCleanupCron } from '../../src/modules/exports/export-cleanup.cron';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

/**
 * TZ 3.13 — eksport E1–E10.
 *
 * Fayl mazmuni `xlsx.writer.spec.ts` da tekshiriladi (raqam formati, jami qatori,
 * freeze pane). Bu yerda oqim sinaladi: ruxsatlar, filial doirasi, qatorlar soni,
 * fon rejimi, signed URL va audit yozuvi.
 */
describe('Eksport (TZ 3.13)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let cleanup: ExportCleanupCron;
  let alfa: SeededCompany;
  let admin: Session;
  let admin2: Session;
  let director: Session;
  let ofis: string;
  let employees: { id: string; branchId: string }[];

  const http = () => request(app.getHttpServer() as App);
  const today = (): string => new Date().toISOString().slice(0, 10);

  const addExpense = async (over: {
    amount: string;
    branchId?: string;
    approve?: boolean;
  }): Promise<string> => {
    const branchId = over.branchId ?? alfa.branchIds[0];
    const employeeId = employees.find((e) => e.branchId === branchId)
      ?.id as string;

    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send({
        branchId,
        categoryId: ofis,
        employeeIds: [employeeId],
        amount: over.amount,
        currency: 'UZS',
        date: today(),
        paymentMethod: 'CASH',
      })
      .expect(201);

    const id = res.body.id as string;
    if (over.approve === false) return id;

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

  const requestExport = async (
    session: Session,
    body: Record<string, unknown>,
    expected = 201,
  ) => {
    const res = await http()
      .post(API('/exports'))
      .set(...session.header)
      .send(body);

    if (res.status !== expected) {
      throw new Error(
        `POST /exports → ${res.status}: ${JSON.stringify(res.body)}`,
      );
    }
    return res.body;
  };

  beforeAll(async () => {
    const ctx = await createHttpApp();
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;
    cleanup = app.get(ExportCleanupCron);
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
    ofis = category.id;

    employees = await prisma.raw.employee.findMany({
      where: { companyId: alfa.companyId },
      select: { id: true, branchId: true },
      orderBy: { fullName: 'asc' },
    });

    // Ikkinchi filialda ham xodim bo'lsin — filial doirasi tekshiruvi uchun
    const second = await prisma.raw.employee.create({
      data: {
        companyId: alfa.companyId,
        fullName: 'Ikkinchi filial xodimi',
        branchId: alfa.branchIds[1],
      },
    });
    employees.push({ id: second.id, branchId: second.branchId });
  });

  // ─── Ruxsatlar ─────────────────────────────────────────────────────────────

  it("direktor audit eksportini (E9) so'rasa 403", async () => {
    await requestExport(director, { type: 'E9', format: 'XLSX' }, 403);
  });

  it('bosh admin E9 ni eksport qila oladi', async () => {
    const job = await requestExport(admin, { type: 'E9', format: 'XLSX' });
    expect(job.status).toBe('DONE');
  });

  it("qo'llab-quvvatlanmaydigan format rad etiladi (E6 + PDF)", async () => {
    await requestExport(admin, { type: 'E6', format: 'PDF' }, 422);
  });

  it("direktor filiallar ro'yxatini (E8) eksport qila olmaydi", async () => {
    await requestExport(director, { type: 'E8', format: 'XLSX' }, 403);
  });

  // ─── E1–E10: har bir tur uchun kamida bitta test ───────────────────────────

  it('E1–E10 turlarining har biri tayyor fayl beradi', async () => {
    await addExpense({ amount: '300000.00' });

    const cases: { type: string; format: string }[] = [
      { type: 'E1', format: 'XLSX' },
      { type: 'E1', format: 'PDF' },
      { type: 'E2', format: 'XLSX' },
      { type: 'E3', format: 'PDF' },
      { type: 'E4', format: 'XLSX' },
      { type: 'E5', format: 'XLSX' },
      { type: 'E6', format: 'XLSX' },
      { type: 'E7', format: 'XLSX' },
      { type: 'E8', format: 'XLSX' },
      { type: 'E9', format: 'XLSX' },
      { type: 'E10', format: 'XLSX' },
    ];

    for (const item of cases) {
      const job = await requestExport(admin, item);
      expect(job.status).toBe('DONE');
      expect(job.ready).toBe(true);
      expect(job.rowCount).not.toBeNull();

      const link = await http()
        .get(API(`/exports/${job.id}/download`))
        .set(...admin.header)
        .expect(200);

      expect(link.body.url).toContain('http');
      expect(link.body.fileName).toContain(item.type);
    }
  });

  // ─── Filial doirasi ────────────────────────────────────────────────────────

  it("direktor eksportida faqat o'z filiali qatorlari bo'ladi", async () => {
    await addExpense({ amount: '100000.00', branchId: alfa.branchIds[0] });
    await addExpense({ amount: '200000.00', branchId: alfa.branchIds[1] });

    const adminJob = await requestExport(admin, { type: 'E1', format: 'XLSX' });
    const directorJob = await requestExport(director, {
      type: 'E1',
      format: 'XLSX',
    });

    expect(adminJob.rowCount).toBe(2);
    expect(directorJob.rowCount).toBe(1);
  });

  it("direktor boshqa filial filtri bilan eksport so'rasa 403", async () => {
    await requestExport(
      director,
      { type: 'E1', format: 'XLSX', filters: { branchId: alfa.branchIds[1] } },
      403,
    );
  });

  // ─── Qatorlar soni ekrandagi natija bilan mos ──────────────────────────────

  it("eksport qatorlari soni filtrlangan ro'yxat bilan mos keladi", async () => {
    await addExpense({ amount: '100000.00' });
    await addExpense({ amount: '200000.00' });
    await addExpense({ amount: '300000.00', approve: false });

    const list = await http()
      .get(API('/expenses'))
      .query({ status: 'APPROVED', limit: 200 })
      .set(...admin.header)
      .expect(200);

    const job = await requestExport(admin, {
      type: 'E1',
      format: 'XLSX',
      filters: { status: 'APPROVED' },
    });

    expect(job.rowCount).toBe(list.body.total);
    expect(job.rowCount).toBe(2);
  });

  // ─── Fon rejimi ────────────────────────────────────────────────────────────

  it('1000 qatordan katta eksport darhol jobId qaytaradi (bloklanmaydi)', async () => {
    await seedManyExpenses(1200);

    const started = Date.now();
    const job = await requestExport(admin, { type: 'E1', format: 'XLSX' });

    expect(job.status).toBe('QUEUED');
    expect(job.ready).toBe(false);
    expect(job.rowCount).toBeNull();
    // Fayl generatsiyasi so'rov ichida bajarilmaydi
    expect(Date.now() - started).toBeLessThan(5000);

    // Tayyor bo'lmagan eksport uchun havola berilmaydi
    const link = await http()
      .get(API(`/exports/${job.id}/download`))
      .set(...admin.header)
      .expect(404);
    expect(link.body.code).toBe('EXPORT_NOT_READY');
  });

  // ─── Audit ─────────────────────────────────────────────────────────────────

  it("har eksportdan keyin audit jurnalida EXPORT yozuvi paydo bo'ladi", async () => {
    const job = await requestExport(admin, { type: 'E7', format: 'XLSX' });

    const entries = await prisma.raw.auditLog.findMany({
      where: { companyId: alfa.companyId, action: 'EXPORT' },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].entityId).toBe(job.id);
    expect(entries[0].entityType).toBe('ExportJob');
  });

  // ─── Ro'yxat va tozalash ───────────────────────────────────────────────────

  it("eksport tarixi so'rovchi bo'yicha chegaralanadi", async () => {
    await requestExport(admin, { type: 'E7', format: 'XLSX' });
    await requestExport(director, { type: 'E7', format: 'XLSX' });

    const adminList = await http()
      .get(API('/exports'))
      .set(...admin.header)
      .expect(200);
    const directorList = await http()
      .get(API('/exports'))
      .set(...director.header)
      .expect(200);

    // Bosh admin hammasini ko'radi, direktor — faqat o'zinikini
    expect(adminList.body.total).toBe(2);
    expect(directorList.body.total).toBe(1);
  });

  it("24 soatdan keyin fayl o'chiriladi va havola berilmaydi", async () => {
    const job = await requestExport(admin, { type: 'E7', format: 'XLSX' });

    await prisma.raw.exportJob.update({
      where: { id: job.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await cleanup.run(new Date());
    expect(result.removed).toBe(1);

    const after = await prisma.raw.exportJob.findUnique({
      where: { id: job.id },
    });
    expect(after?.storageKey).toBeNull();

    const link = await http()
      .get(API(`/exports/${job.id}/download`))
      .set(...admin.header)
      .expect(404);
    expect(link.body.code).toBe('EXPORT_NOT_READY');
  });

  /** Fon rejimini sinash uchun tez to'ldirish — HTTP orqali 1200 ta yaratish sekin */
  async function seedManyExpenses(count: number): Promise<void> {
    const branchId = alfa.branchIds[0];
    const year = new Date().getFullYear();

    await prisma.raw.expense.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        companyId: alfa.companyId,
        globalNumber: `EXP-${String(index + 1).padStart(6, '0')}`,
        branchNumber: `AAA-${year}-${String(index + 1).padStart(4, '0')}`,
        branchSeqYear: year,
        branchSeq: index + 1,
        branchId,
        categoryId: ofis,
        amount: '10000.00',
        currency: 'UZS' as const,
        rateUsed: '1.000000',
        rateSource: 'MANUAL' as const,
        amountUzs: '10000.00',
        date: new Date(today()),
        paymentMethod: 'CASH' as const,
        createdByUserId: alfa.adminId,
        channel: 'WEB' as const,
        status: 'APPROVED' as const,
      })),
    });
  }
});
