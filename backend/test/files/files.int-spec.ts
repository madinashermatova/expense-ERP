import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import {
  FilesService,
  UploadedFileInput,
} from '../../src/modules/files/files.service';
import { TenantContextService } from '../../src/common/tenancy/tenant-context.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';
import {
  Currency,
  PaymentMethod,
  Channel,
  Role,
} from '../../src/generated/prisma/enums';

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);
const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 3)]);

const asUpload = (
  buffer: Buffer,
  name: string,
  mimetype: string,
): UploadedFileInput => ({
  originalname: name,
  mimetype,
  size: buffer.length,
  buffer,
});

describe('Fayllar (TZ 3.6, 4.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let files: FilesService;
  let tenant: TenantContextService;
  let close: () => Promise<void>;
  let alfa: SeededCompany;
  let beta: SeededCompany;
  let admin: Session;

  const http = () => request(app.getHttpServer() as App);

  /** Fayl biriktirish uchun minimal xarajat yozuvi (to'liq xarajat mantiqi S6 da) */
  const createExpense = async (company: SeededCompany): Promise<string> => {
    const category = await prisma.raw.category.create({
      data: { companyId: company.companyId, nameUz: 'Test', nameRu: 'Тест' },
    });
    const user = await prisma.raw.user.findFirstOrThrow({
      where: { companyId: company.companyId, role: Role.ADMIN },
    });

    const expense = await prisma.raw.expense.create({
      data: {
        companyId: company.companyId,
        globalNumber: `EXP-${Date.now()}${Math.floor(Math.random() * 1000)}`,
        branchNumber: `AAA-2026-${Math.floor(Math.random() * 10000)}`,
        branchSeqYear: 2026,
        branchSeq: Math.floor(Math.random() * 100000),
        branchId: company.branchIds[0],
        categoryId: category.id,
        amount: '100000.00',
        currency: Currency.UZS,
        rateUsed: '1.000000',
        rateSource: 'MANUAL',
        amountUzs: '100000.00',
        date: new Date('2026-08-01'),
        paymentMethod: PaymentMethod.CASH,
        createdByUserId: user.id,
        channel: Channel.WEB,
      },
    });
    return expense.id;
  };

  /** Servis chaqiruvlari tenant konteksti ichida bajarilishi shart */
  const inCompany = <T>(
    company: SeededCompany,
    fn: () => Promise<T>,
  ): Promise<T> =>
    tenant.runAsync({ companyId: company.companyId, role: Role.ADMIN }, fn);

  beforeAll(async () => {
    const ctx = await createHttpApp();
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;
    files = app.get(FilesService);
    tenant = app.get(TenantContextService);
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    alfa = await seedCompany(prisma, 'alfa', 'alfa.uz');
    beta = await seedCompany(prisma, 'beta', 'beta.uz');
    admin = await loginAs(app, alfa.adminEmail);
  });

  describe('validatsiya', () => {
    it('png qabul qilinadi', () => {
      expect(files.validate(asUpload(png, 'chek.png', 'image/png'))).toBe(
        'image/png',
      );
    });

    it('10 MB dan katta fayl 413 qaytaradi', () => {
      const big = Buffer.concat([png, Buffer.alloc(11 * 1024 * 1024)]);
      expect(() =>
        files.validate(asUpload(big, 'katta.png', 'image/png')),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
        }),
      );
    });

    it('ruxsat etilmagan tur 422 qaytaradi', () => {
      const gif = Buffer.from('GIF89a-----------');
      expect(() =>
        files.validate(asUpload(gif, 'rasm.gif', 'image/gif')),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'FILE_TYPE_NOT_ALLOWED' }),
        }),
      );
    });

    it('kengaytma almashtirilgan bajariladigan fayl rad etiladi', () => {
      const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      expect(() =>
        files.validate(asUpload(exe, 'chek.png', 'image/png')),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'FILE_TYPE_NOT_ALLOWED' }),
        }),
      );
    });

    it("e'lon qilingan MIME mazmunga mos kelmasa 422", () => {
      expect(() =>
        files.validate(asUpload(pdf, 'chek.png', 'image/png')),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'FILE_CONTENT_MISMATCH' }),
        }),
      );
    });

    it('5 tadan ortiq fayl 422 qaytaradi', () => {
      expect(() => files.assertFileCount(3, 3)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'TOO_MANY_FILES' }),
        }),
      );
      expect(() => files.assertFileCount(0, 5)).not.toThrow();
    });
  });

  describe('saqlash va kalitlar', () => {
    it('kalit {companyId}/ bilan boshlanadi va kengaytma aniqlangan turdan olinadi', async () => {
      const expenseId = await createExpense(alfa);

      const saved = await inCompany(alfa, () =>
        files.attachToExpense(
          expenseId,
          [asUpload(png, 'chek.png', 'image/png')],
          alfa.adminId,
        ),
      );

      const row = await prisma.raw.expenseFile.findUniqueOrThrow({
        where: { id: saved[0].id },
      });
      expect(
        row.storageKey.startsWith(`${alfa.companyId}/expenses/${expenseId}/`),
      ).toBe(true);
      expect(row.storageKey.endsWith('.png')).toBe(true);
      expect(row.sizeBytes).toBe(png.length);
    });

    it('fayl nomi tozalanadi', async () => {
      const expenseId = await createExpense(alfa);

      const saved = await inCompany(alfa, () =>
        files.attachToExpense(
          expenseId,
          [asUpload(pdf, '../../etc/passwd.pdf', 'application/pdf')],
          alfa.adminId,
        ),
      );

      expect(saved[0].originalName).not.toContain('/');
    });

    it('fayllar soni chegarasi saqlashda ham tekshiriladi', async () => {
      const expenseId = await createExpense(alfa);
      const five = Array.from({ length: 5 }, (_, i) =>
        asUpload(png, `chek${i}.png`, 'image/png'),
      );

      await inCompany(alfa, () =>
        files.attachToExpense(expenseId, five, alfa.adminId),
      );

      await expect(
        inCompany(alfa, () =>
          files.attachToExpense(
            expenseId,
            [asUpload(png, 'oltinchi.png', 'image/png')],
            alfa.adminId,
          ),
        ),
      ).rejects.toMatchObject({ response: { code: 'TOO_MANY_FILES' } });
    });
  });

  describe('signed URL (TZ 4.2)', () => {
    it("o'z faylига signed URL beriladi va muddati 15 daqiqa", async () => {
      const expenseId = await createExpense(alfa);
      const saved = await inCompany(alfa, () =>
        files.attachToExpense(
          expenseId,
          [asUpload(png, 'chek.png', 'image/png')],
          alfa.adminId,
        ),
      );

      const res = await http()
        .get(API(`/files/${saved[0].id}/url`))
        .set(...admin.header)
        .expect(200);

      expect(res.body.url).toContain('X-Amz-Signature');
      const ttlMs =
        new Date(res.body.expiresAt as string).getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(14 * 60_000);
      expect(ttlMs).toBeLessThanOrEqual(15 * 60_000 + 5_000);
    });

    it('boshqa kompaniya fayliga signed URL berilmaydi (404)', async () => {
      const betaExpense = await createExpense(beta);
      const betaFile = await inCompany(beta, () =>
        files.attachToExpense(
          betaExpense,
          [asUpload(png, 'beta.png', 'image/png')],
          beta.adminId,
        ),
      );

      await http()
        .get(API(`/files/${betaFile[0].id}/url`))
        .set(...admin.header)
        .expect(404);
    });

    it("mavjud bo'lmagan fayl 404", async () => {
      await http()
        .get(API('/files/00000000-0000-4000-8000-000000000999/url'))
        .set(...admin.header)
        .expect(404);
    });

    it("tokensiz so'rov 401", async () => {
      await http()
        .get(API('/files/00000000-0000-4000-8000-000000000999/url'))
        .expect(401);
    });
  });

  describe("o'chirish", () => {
    it("fayl yozuvi ham, obyekt ham o'chadi", async () => {
      const expenseId = await createExpense(alfa);
      const saved = await inCompany(alfa, () =>
        files.attachToExpense(
          expenseId,
          [asUpload(png, 'chek.png', 'image/png')],
          alfa.adminId,
        ),
      );

      await inCompany(alfa, () => files.removeExpenseFile(saved[0].id));

      const row = await prisma.raw.expenseFile.findUnique({
        where: { id: saved[0].id },
      });
      expect(row).toBeNull();
    });
  });
});
