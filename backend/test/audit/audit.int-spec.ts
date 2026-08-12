import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

interface AuditChange {
  field: string;
  old: unknown;
  new: unknown;
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userName: string | null;
  userRole: string | null;
  changes: AuditChange[] | null;
  channel: string;
}

/** TZ 3.14 — audit jurnali: kim, qachon, nima o'zgardi; append-only; faqat admin ko'radi */
describe('Audit jurnali (TZ 3.14)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let alfa: SeededCompany;
  let admin: Session;
  let director: Session;
  let categoryId: string;
  let employeeId: string;

  const http = () => request(app.getHttpServer() as App);

  const entries = async (
    query: Record<string, string> = {},
  ): Promise<AuditEntry[]> => {
    const res = await http()
      .get(API('/audit'))
      .query({ limit: 200, ...query })
      .set(...admin.header)
      .expect(200);
    return res.body.items as AuditEntry[];
  };

  const changeOf = (
    entry: AuditEntry,
    field: string,
  ): AuditChange | undefined =>
    entry.changes?.find((change) => change.field === field);

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

  // ─── Ruxsat ────────────────────────────────────────────────────────────────

  it('direktor jurnalga kira olmaydi (403)', async () => {
    await http()
      .get(API('/audit'))
      .set(...director.header)
      .expect(403);
  });

  it("jurnalni o'zgartirish yoki o'chirish uchun endpoint yo'q", async () => {
    const [entry] = await entries();

    await http()
      .patch(API(`/audit/${entry.id}`))
      .set(...admin.header)
      .send({ action: 'soxta' })
      .expect(404);

    await http()
      .delete(API(`/audit/${entry.id}`))
      .set(...admin.header)
      .expect(404);
  });

  // ─── Yozuvlar ──────────────────────────────────────────────────────────────

  it('login jurnalga tushadi (kim, kanal)', async () => {
    const login = (
      await entries({ action: 'auth.login', userId: alfa.adminId })
    )[0];

    expect(login).toBeDefined();
    expect(login.entityType).toBe('User');
    expect(login.userName).toBe('Admin Bir');
    expect(login.userRole).toBe('ADMIN');
    expect(login.channel).toBe('WEB');
  });

  it('filial tahrirlanganda eski va yangi qiymat yoziladi', async () => {
    await http()
      .patch(API(`/branches/${alfa.branchIds[0]}`))
      .set(...admin.header)
      .send({ name: 'Chilonzor filiali' })
      .expect(200);

    const [entry] = await entries({ action: 'branch.update' });
    const change = changeOf(entry, 'name');

    expect(entry.entityId).toBe(alfa.branchIds[0]);
    expect(change).toEqual({
      field: 'name',
      old: 'Birinchi filial',
      new: 'Chilonzor filiali',
    });
  });

  it('kategoriya yaratilganda yozuv qoladi', async () => {
    const created = await http()
      .post(API('/categories'))
      .set(...admin.header)
      .send({ nameUz: 'Transport', nameRu: 'Транспорт' })
      .expect(201);

    const [entry] = await entries({ action: 'category.create' });

    expect(entry.entityId).toBe(created.body.id);
    expect(changeOf(entry, 'nameUz')?.new).toBe('Transport');
  });

  it('xarajat summasi tahrirlanganda { amount, old, new } yoziladi', async () => {
    const created = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send({
        branchId: alfa.branchIds[0],
        categoryId,
        employeeIds: [employeeId],
        amount: '150000.00',
        currency: 'UZS',
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: 'CASH',
      })
      .expect(201);

    await http()
      .patch(API(`/expenses/${created.body.id}`))
      .set(...admin.header)
      .send({
        reason: "Chek summasi noto'g'ri kiritilgan",
        amount: '175000.00',
      })
      .expect(200);

    const [entry] = await entries({ action: 'expense.update' });
    const change = changeOf(entry, 'amount');

    expect(change?.old).toBe('150000.00');
    expect(change?.new).toBe('175000.00');
  });

  it('parol maydonlari jurnalga tushmaydi', async () => {
    await http()
      .post(API('/employees'))
      .set(...admin.header)
      .send({
        fullName: 'Yangi Xodim',
        branchId: alfa.branchIds[0],
        phone: '+998901234567',
        role: 'WORKER',
        email: 'yangi@alfa.uz',
        password: 'Parol123!',
      })
      .expect(201);

    const [entry] = await entries({ action: 'employee.create' });
    const fields = (entry.changes ?? []).map((change) => change.field);

    expect(fields).not.toContain('password');
    expect(fields).not.toContain('passwordHash');
  });

  // ─── Filtrlar ──────────────────────────────────────────────────────────────

  it("obyekt turi, amal va erkin qidiruv bo'yicha filtrlaydi", async () => {
    await http()
      .patch(API(`/branches/${alfa.branchIds[0]}`))
      .set(...admin.header)
      .send({ name: 'Yangi nom' })
      .expect(200);

    const byEntity = await entries({ entityType: 'Branch' });
    expect(byEntity.every((row) => row.entityType === 'Branch')).toBe(true);

    const byAction = await entries({ action: 'auth.login' });
    expect(byAction.every((row) => row.action === 'auth.login')).toBe(true);

    const bySearch = await entries({ search: alfa.branchIds[0] });
    expect(bySearch.length).toBeGreaterThan(0);
    expect(bySearch.every((row) => row.entityId === alfa.branchIds[0])).toBe(
      true,
    );
  });

  it("kelajakdagi sana filtri bo'sh natija beradi", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);

    const rows = await entries({ dateFrom: tomorrow });
    expect(rows).toHaveLength(0);
  });

  it("facets amal va obyekt turlari ro'yxatini beradi", async () => {
    const res = await http()
      .get(API('/audit/facets'))
      .set(...admin.header)
      .expect(200);

    expect(res.body.actions).toContain('auth.login');
    expect(res.body.entityTypes).toContain('User');
  });

  // ─── E9 eksporti ───────────────────────────────────────────────────────────

  it('E9 eksporti jurnal filtrlarini takrorlaydi', async () => {
    const logins = await entries({ action: 'auth.login' });

    const job = await http()
      .post(API('/exports'))
      .set(...admin.header)
      .send({ type: 'E9', format: 'XLSX', filters: { action: 'auth.login' } })
      .expect(201);

    // Eksport so'rovining o'zi ham jurnalga tushadi, lekin `action` filtri uni chiqarib tashlaydi
    expect(job.body.rowCount).toBe(logins.length);
  });
});
