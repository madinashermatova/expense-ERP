import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

/** Haqiqiy PNG magic-byte — `FilesService` mazmunga qarab tekshiradi (TZ 4.2) */
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);

describe('Xarajatlar yadrosi (TZ 3.6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let alfa: SeededCompany;
  let admin: Session;
  let director: Session;
  let categoryId: string;
  let receiptCategoryId: string;
  let employeeIds: string[];

  const http = () => request(app.getHttpServer() as App);

  const today = (): string => new Date().toISOString().slice(0, 10);

  const payload = (over: Record<string, unknown> = {}) => ({
    branchId: alfa.branchIds[0],
    categoryId,
    employeeIds: [employeeIds[0]],
    amount: '150000.00',
    currency: 'UZS',
    date: today(),
    paymentMethod: 'CASH',
    ...over,
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
    director = await loginAs(app, alfa.directorEmail);

    const category = await prisma.raw.category.create({
      data: {
        companyId: alfa.companyId,
        nameUz: 'Ofis',
        nameRu: 'Офис',
      },
    });
    const receiptCategory = await prisma.raw.category.create({
      data: {
        companyId: alfa.companyId,
        nameUz: 'Yoqilg‘i',
        nameRu: 'Топливо',
        receiptRequired: true,
      },
    });
    categoryId = category.id;
    receiptCategoryId = receiptCategory.id;

    const employees = await prisma.raw.employee.findMany({
      where: { companyId: alfa.companyId, branchId: alfa.branchIds[0] },
      orderBy: { fullName: 'asc' },
    });
    employeeIds = employees.map((e) => e.id);
  });

  // ─── Yaratish ──────────────────────────────────────────────────────────────

  it('ikkala raqam ham beriladi va tasdiqlash oqimiga tushadi', async () => {
    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    expect(res.body.globalNumber).toBe('EXP-000001');
    expect(res.body.branchNumber).toMatch(/^AAA-\d{4}-0001$/);
    expect(res.body.status).toBe('DIRECTOR_PENDING');
    expect(res.body.amountUzs).toBe('150000.00');
    expect(res.body.shares).toHaveLength(1);
    expect(res.body.shares[0].amount).toBe('150000.00');
  });

  it('globalNumber uzluksiz, branchNumber esa filialga bog‘liq', async () => {
    const first = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    const other = await prisma.raw.employee.create({
      data: {
        companyId: alfa.companyId,
        fullName: 'Ikkinchi filial xodimi',
        branchId: alfa.branchIds[1],
      },
    });

    const second = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ branchId: alfa.branchIds[1], employeeIds: [other.id] }))
      .expect(201);

    expect(first.body.globalNumber).toBe('EXP-000001');
    expect(second.body.globalNumber).toBe('EXP-000002');
    expect(first.body.branchNumber).toMatch(/^AAA-\d{4}-0001$/);
    expect(second.body.branchNumber).toMatch(/^BBB-\d{4}-0001$/);
  });

  it('filial ketma-ketligi yangi yilda 1 dan boshlanadi, global davom etadi', async () => {
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ date: '2025-06-15' }))
      .expect(201);

    const next = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ date: '2026-01-04', amount: '10000.00' }))
      .expect(201);

    expect(next.body.branchNumber).toBe('AAA-2026-0001');
    expect(next.body.globalNumber).toBe('EXP-000002');
  });

  it('parallel yaratishda raqamlar takrorlanmaydi', async () => {
    const CONCURRENT = 100;

    const results = await Promise.all(
      Array.from({ length: CONCURRENT }, () =>
        http()
          .post(API('/expenses'))
          .set(...admin.header)
          .send(payload()),
      ),
    );

    expect(results.every((r) => r.status === 201)).toBe(true);

    const globals = new Set(results.map((r) => r.body.globalNumber));
    const branches = new Set(results.map((r) => r.body.branchNumber));
    expect(globals.size).toBe(CONCURRENT);
    expect(branches.size).toBe(CONCURRENT);
  });

  // ─── Taqsimlash ────────────────────────────────────────────────────────────

  it('teng taqsimlashda qoldiq tiyin birinchi xodimga qo‘shiladi', async () => {
    const three = employeeIds.slice(0, 3);
    expect(three).toHaveLength(3);

    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ amount: '100000.00', employeeIds: three }))
      .expect(201);

    const shares = res.body.shares as { employeeId: string; amount: string }[];
    const amounts = shares.map((s) => s.amount).sort();
    expect(amounts).toEqual(['33333.33', '33333.33', '33333.34']);

    // Qoldiq tiyin aynan ro'yxatdagi birinchi xodimga tegadi (TZ 3.6)
    const first = shares.find((s) => s.employeeId === three[0]);
    expect(first?.amount).toBe('33333.34');

    const sum = shares.reduce((acc, s) => acc + Number(s.amount), 0);
    expect(sum.toFixed(2)).toBe('100000.00');
  });

  it('qo‘lda taqsimlashda yig‘indi mos kelmasa 422', async () => {
    const two = employeeIds.slice(0, 2);

    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(
        payload({
          amount: '100000.00',
          employeeIds: two,
          shares: [
            { employeeId: two[0], amount: '60000.00' },
            { employeeId: two[1], amount: '30000.00' },
          ],
        }),
      )
      .expect(422);

    expect(res.body.code).toBe('SHARES_SUM_MISMATCH');
  });

  it('qo‘lda taqsimlash yig‘indi teng bo‘lganda o‘tadi', async () => {
    const two = employeeIds.slice(0, 2);

    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(
        payload({
          amount: '100000.00',
          employeeIds: two,
          shares: [
            { employeeId: two[0], amount: '70000.00' },
            { employeeId: two[1], amount: '30000.00' },
          ],
        }),
      )
      .expect(201);

    expect(res.body.shares).toHaveLength(2);
  });

  it('boshqa filial xodimiga taqsimlab bo‘lmaydi', async () => {
    const other = await prisma.raw.employee.create({
      data: {
        companyId: alfa.companyId,
        fullName: 'Begona',
        branchId: alfa.branchIds[1],
      },
    });

    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ employeeIds: [other.id] }))
      .expect(422);

    expect(res.body.code).toBe('EMPLOYEE_WRONG_BRANCH');
  });

  // ─── Validatsiya ───────────────────────────────────────────────────────────

  it('nol yoki manfiy summa qabul qilinmaydi', async () => {
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ amount: '0' }))
      .expect(422);

    // Manfiy summa DTO regex ida ushlanadi
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ amount: '-500' }))
      .expect(422);
  });

  it('kelajak sanasi 422 qaytaradi', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);

    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ date: tomorrow }))
      .expect(422);

    expect(res.body.code).toBe('DATE_IN_FUTURE');
  });

  it('izoh majburiy kategoriyada izohsiz 422', async () => {
    const strict = await prisma.raw.category.create({
      data: {
        companyId: alfa.companyId,
        nameUz: 'Mehmon',
        nameRu: 'Гость',
        commentRequired: true,
      },
    });

    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ categoryId: strict.id }))
      .expect(422);

    expect(res.body.code).toBe('COMMENT_REQUIRED');
  });

  it('kategoriya bir martalik chegarasidan oshsa 422', async () => {
    const capped = await prisma.raw.category.create({
      data: {
        companyId: alfa.companyId,
        nameUz: 'Kanselyariya',
        nameRu: 'Канцелярия',
        maxAmountPerEntry: '50000.00',
      },
    });

    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ categoryId: capped.id, amount: '50000.01' }))
      .expect(422);

    expect(res.body.code).toBe('CATEGORY_LIMIT_EXCEEDED');
  });

  it('kurs mavjud bo‘lmaganda USD xarajat 422 (TZ 3.5)', async () => {
    const res = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ currency: 'USD', amount: '100.00' }))
      .expect(422);

    expect(res.body.code).toBe('CURRENCY_RATE_MISSING');
  });

  it('USD xarajatda kurs snapshot qilinadi va keyin o‘zgarmaydi', async () => {
    await prisma.raw.currencyRate.create({
      data: {
        companyId: alfa.companyId,
        date: new Date(`${today()}T00:00:00.000Z`),
        currency: 'USD',
        rate: '12500.000000',
        source: 'AUTO',
      },
    });

    const created = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ currency: 'USD', amount: '100.00' }))
      .expect(201);

    expect(created.body.amountUzs).toBe('1250000.00');

    await prisma.raw.currencyRate.updateMany({
      where: { companyId: alfa.companyId },
      data: { rate: '13000.000000' },
    });

    const fetched = await http()
      .get(API(`/expenses/${created.body.id}`))
      .set(...admin.header)
      .expect(200);

    expect(fetched.body.amountUzs).toBe('1250000.00');
    expect(fetched.body.rateUsed).toBe('12500.000000');
  });

  // ─── Isbot majburiy kategoriya ─────────────────────────────────────────────

  it('isbot majburiy kategoriyada yozuv DRAFT da tug‘iladi va cheksiz yuborilmaydi', async () => {
    const created = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ categoryId: receiptCategoryId }))
      .expect(201);

    expect(created.body.status).toBe('DRAFT');
    expect(created.body.globalNumber).toBe('EXP-000001');

    const res = await http()
      .post(API(`/expenses/${created.body.id}/submit`))
      .set(...admin.header)
      .expect(422);

    expect(res.body.code).toBe('RECEIPT_REQUIRED');
  });

  it('chek biriktirilgandan keyin qoralama tasdiqlash oqimiga o‘tadi', async () => {
    const created = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ categoryId: receiptCategoryId }))
      .expect(201);

    const uploaded = await http()
      .post(API(`/expenses/${created.body.id}/files`))
      .set(...admin.header)
      .attach('files', png, { filename: 'chek.png', contentType: 'image/png' })
      .expect(201);

    expect(uploaded.body).toHaveLength(1);

    const submitted = await http()
      .post(API(`/expenses/${created.body.id}/submit`))
      .set(...admin.header)
      .expect(201);

    expect(submitted.body.status).toBe('DIRECTOR_PENDING');
    // Raqamlar o'zgarmaydi (TZ 3.6)
    expect(submitted.body.globalNumber).toBe(created.body.globalNumber);
    expect(submitted.body.branchNumber).toBe(created.body.branchNumber);

    const card = await http()
      .get(API(`/expenses/${created.body.id}`))
      .set(...admin.header)
      .expect(200);
    expect(card.body.files).toHaveLength(1);
    expect(card.body.files[0].originalName).toBe('chek.png');

    await http()
      .delete(API(`/expenses/${created.body.id}/files/${uploaded.body[0].id}`))
      .set(...admin.header)
      .expect(204);

    const after = await http()
      .get(API(`/expenses/${created.body.id}`))
      .set(...admin.header)
      .expect(200);
    expect(after.body.files).toHaveLength(0);
  });

  // ─── Dublikat ──────────────────────────────────────────────────────────────

  it('10 daqiqa ichidagi bir xil yozuv ogohlantiradi, lekin bloklamaydi', async () => {
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    const second = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    expect(second.body.duplicateWarning).toBeDefined();
    expect(second.body.duplicateWarning.globalNumber).toBe('EXP-000001');
  });

  // ─── Ro'yxat ───────────────────────────────────────────────────────────────

  it('qidiruv ikkala raqam bo‘yicha ham ishlaydi', async () => {
    const created = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    for (const q of [created.body.globalNumber, created.body.branchNumber]) {
      const res = await http()
        .get(API('/expenses'))
        .query({ q })
        .set(...admin.header)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.items[0].id).toBe(created.body.id);
    }
  });

  it('filtrlar va pagination ishlaydi', async () => {
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ amount: '10000.00', paymentMethod: 'CASH' }))
      .expect(201);
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ amount: '20000.00', paymentMethod: 'CARD' }))
      .expect(201);

    const byMethod = await http()
      .get(API('/expenses'))
      .query({ paymentMethod: 'CARD' })
      .set(...admin.header)
      .expect(200);
    expect(byMethod.body.total).toBe(1);

    const byAmount = await http()
      .get(API('/expenses'))
      .query({ amountFrom: '15000' })
      .set(...admin.header)
      .expect(200);
    expect(byAmount.body.total).toBe(1);

    const paged = await http()
      .get(API('/expenses'))
      .query({ page: 2, limit: 1 })
      .set(...admin.header)
      .expect(200);
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.totalPages).toBe(2);
  });

  it('10 000 yozuvda ro‘yxat sahifasi 2 soniyadan tez javob beradi', async () => {
    const TOTAL = 10_000;
    const day = new Date('2026-03-01T00:00:00.000Z');

    await prisma.raw.expense.createMany({
      data: Array.from({ length: TOTAL }, (_, i) => ({
        companyId: alfa.companyId,
        globalNumber: `EXP-${String(i + 1).padStart(6, '0')}`,
        branchNumber: `AAA-2026-${String(i + 1).padStart(4, '0')}`,
        branchSeqYear: 2026,
        branchSeq: i + 1,
        branchId: alfa.branchIds[0],
        categoryId,
        amount: '10000.00',
        currency: 'UZS' as const,
        rateUsed: '1.000000',
        rateSource: 'MANUAL' as const,
        amountUzs: '10000.00',
        date: day,
        paymentMethod: 'CASH' as const,
        createdByUserId: alfa.adminId,
        channel: 'WEB' as const,
      })),
    });

    const started = Date.now();
    const res = await http()
      .get(API('/expenses'))
      .query({ page: 1, limit: 25 })
      .set(...admin.header)
      .expect(200);
    const elapsed = Date.now() - started;

    expect(res.body.total).toBe(TOTAL);
    expect(res.body.items).toHaveLength(25);
    expect(elapsed).toBeLessThan(2000);
  });

  it('direktor faqat o‘z filialini ko‘radi', async () => {
    const other = await prisma.raw.employee.create({
      data: {
        companyId: alfa.companyId,
        fullName: 'Ikkinchi',
        branchId: alfa.branchIds[1],
      },
    });

    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);
    const foreign = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload({ branchId: alfa.branchIds[1], employeeIds: [other.id] }))
      .expect(201);

    const list = await http()
      .get(API('/expenses'))
      .set(...director.header)
      .expect(200);
    expect(list.body.total).toBe(1);

    await http()
      .get(API(`/expenses/${foreign.body.id}`))
      .set(...director.header)
      .expect(404);
  });

  it('boshqa kompaniyaning xarajati ko‘rinmaydi', async () => {
    const created = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    const beta = await seedCompany(prisma, 'beta', 'beta.uz');
    const betaAdmin = await loginAs(app, beta.adminEmail);

    await http()
      .get(API(`/expenses/${created.body.id}`))
      .set(...betaAdmin.header)
      .expect(404);

    const list = await http()
      .get(API('/expenses'))
      .set(...betaAdmin.header)
      .expect(200);
    expect(list.body.total).toBe(0);
  });

  // ─── O'chirish ─────────────────────────────────────────────────────────────

  it('o‘chirish soft delete qiladi va audit yozuvi qoldiradi', async () => {
    const created = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    await http()
      .delete(API(`/expenses/${created.body.id}`))
      .set(...admin.header)
      .expect(204);

    const row = await prisma.raw.expense.findUnique({
      where: { id: created.body.id },
    });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();

    const list = await http()
      .get(API('/expenses'))
      .set(...admin.header)
      .expect(200);
    expect(list.body.total).toBe(0);

    const audit = await prisma.raw.auditLog.findMany({
      where: { entityId: created.body.id, action: 'expense.delete' },
    });
    expect(audit).toHaveLength(1);
  });

  it('tasdiqlangan xarajatni o‘chirib bo‘lmaydi', async () => {
    const created = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    await prisma.raw.expense.update({
      where: { id: created.body.id },
      data: { status: 'APPROVED' },
    });

    const res = await http()
      .delete(API(`/expenses/${created.body.id}`))
      .set(...admin.header)
      .expect(409);

    expect(res.body.code).toBe('EXPENSE_NOT_DELETABLE');
  });
});
