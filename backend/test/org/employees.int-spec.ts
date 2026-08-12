import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import {
  seedCompany,
  SeededCompany,
  TEST_PASSWORD,
} from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

describe('Xodimlar (TZ 3.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let alfa: SeededCompany;
  let beta: SeededCompany;
  let admin: Session;
  let director: Session;

  const http = () => request(app.getHttpServer() as App);

  const newEmployee = (over: Record<string, unknown> = {}) => ({
    fullName: 'Yangi Xodim',
    branchId: alfa.branchIds[0],
    role: 'WORKER',
    email: `yangi${Date.now()}@alfa.uz`,
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
    beta = await seedCompany(prisma, 'beta', 'beta.uz');
    admin = await loginAs(app, alfa.adminEmail);
    director = await loginAs(app, alfa.directorEmail);
  });

  describe('yaratish', () => {
    it('xodim yaratilganda User hisobi va bir martalik parol qaytadi', async () => {
      const res = await http()
        .post(API('/employees'))
        .set(...admin.header)
        .send(newEmployee({ email: 'test1@alfa.uz', phone: '+998901234567' }))
        .expect(201);

      expect(res.body.tempPassword).toEqual(expect.any(String));
      expect(res.body.tempPassword.length).toBeGreaterThanOrEqual(12);
      expect(res.body.employee.userId).toEqual(expect.any(String));
      expect(res.body.employee.email).toBe('test1@alfa.uz');

      const user = await prisma.raw.user.findFirst({
        where: { employeeId: res.body.employee.id as string },
      });
      expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it("yaratilgan xodim o'z paroli bilan tizimga kira oladi", async () => {
      const created = await http()
        .post(API('/employees'))
        .set(...admin.header)
        .send(newEmployee({ email: 'kirish@alfa.uz', role: 'DIRECTOR' }))
        .expect(201);

      await http()
        .post(API('/auth/login'))
        .send({ login: 'kirish@alfa.uz', password: created.body.tempPassword })
        .expect(200);
    });

    it("direktor ADMIN roli bilan xodim yaratmoqchi bo'lsa 403", async () => {
      const res = await http()
        .post(API('/employees'))
        .set(...director.header)
        .send(newEmployee({ role: 'ADMIN', email: 'admin-urinish@alfa.uz' }))
        .expect(403);

      expect(res.body.code).toBe('ROLE_FORBIDDEN');
    });

    it("direktor boshqa filialga xodim qo'sha olmaydi 403", async () => {
      const res = await http()
        .post(API('/employees'))
        .set(...director.header)
        .send(
          newEmployee({ branchId: alfa.branchIds[1], email: 'boshqa@alfa.uz' }),
        )
        .expect(403);

      expect(res.body.code).toBe('BRANCH_FORBIDDEN');
    });

    it("direktor o'z filialiga WORKER qo'sha oladi", async () => {
      await http()
        .post(API('/employees'))
        .set(...director.header)
        .send(newEmployee({ email: 'ishchi@alfa.uz' }))
        .expect(201);
    });

    it('mavjud telefon raqami 409 qaytaradi', async () => {
      await http()
        .post(API('/employees'))
        .set(...admin.header)
        .send(newEmployee({ email: 'tel1@alfa.uz', phone: '+998901111111' }))
        .expect(201);

      const res = await http()
        .post(API('/employees'))
        .set(...admin.header)
        .send(newEmployee({ email: 'tel2@alfa.uz', phone: '+998901111111' }))
        .expect(409);

      expect(res.body.code).toBe('PHONE_TAKEN');
    });

    it('bir xil telefon boshqa kompaniyada muammosiz (tenant doirasidagi unikallik)', async () => {
      const betaAdmin = await loginAs(app, beta.adminEmail);

      await http()
        .post(API('/employees'))
        .set(...admin.header)
        .send(newEmployee({ email: 'a@alfa.uz', phone: '+998905555555' }))
        .expect(201);

      await http()
        .post(API('/employees'))
        .set(...betaAdmin.header)
        .send({
          fullName: 'Beta Xodim',
          branchId: beta.branchIds[0],
          role: 'WORKER',
          email: 'b@beta.uz',
          phone: '+998905555555',
        })
        .expect(201);
    });

    it('band email 409 qaytaradi', async () => {
      const res = await http()
        .post(API('/employees'))
        .set(...admin.header)
        .send(newEmployee({ email: alfa.adminEmail }))
        .expect(409);

      expect(res.body.code).toBe('LOGIN_TAKEN');
    });

    it("arxivlangan filialga xodim qo'shib bo'lmaydi", async () => {
      await http()
        .post(API(`/branches/${alfa.branchIds[1]}/archive`))
        .set(...admin.header)
        .expect(201);

      const res = await http()
        .post(API('/employees'))
        .set(...admin.header)
        .send(
          newEmployee({ branchId: alfa.branchIds[1], email: 'arxiv@alfa.uz' }),
        )
        .expect(422);

      expect(res.body.code).toBe('BRANCH_ARCHIVED');
    });

    it('boshqa kompaniya filiali bilan xodim yaratish bloklanadi', async () => {
      const res = await http()
        .post(API('/employees'))
        .set(...admin.header)
        .send(
          newEmployee({ branchId: beta.branchIds[0], email: 'cross@alfa.uz' }),
        )
        .expect(422);

      expect(res.body.code).toBe('BRANCH_NOT_FOUND');
    });
  });

  describe("ro'yxat va doira", () => {
    it("direktor faqat o'z filiali xodimlarini ko'radi", async () => {
      const res = await http()
        .get(API('/employees'))
        .set(...director.header)
        .expect(200);

      const branchIds = new Set(
        res.body.items.map((e: { branchId: string }) => e.branchId),
      );
      expect([...branchIds]).toEqual([alfa.branchIds[0]]);
    });

    it("direktor boshqa filial branchId si bilan so'rasa 403", async () => {
      const res = await http()
        .get(API(`/employees?branchId=${alfa.branchIds[1]}`))
        .set(...director.header)
        .expect(403);

      expect(res.body.code).toBe('BRANCH_FORBIDDEN');
    });

    it("boshqa kompaniya xodimlari ro'yxatda ko'rinmaydi", async () => {
      const res = await http()
        .get(API('/employees?limit=200'))
        .set(...admin.header)
        .expect(200);

      const emails = res.body.items.map((e: { email: string }) => e.email);
      expect(emails.every((e: string) => e.endsWith('@alfa.uz'))).toBe(true);
    });

    it("qidiruv ism bo'yicha ishlaydi", async () => {
      const res = await http()
        .get(API('/employees?q=Direktor'))
        .set(...admin.header)
        .expect(200);

      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('parol tiklash', () => {
    it('yangi parol qaytadi va eskisi ishlamaydi', async () => {
      const employee = await prisma.raw.employee.findFirstOrThrow({
        where: {
          companyId: alfa.companyId,
          user: { email: alfa.directorEmail },
        },
      });

      const res = await http()
        .post(API(`/employees/${employee.id}/reset-password`))
        .set(...admin.header)
        .expect(201);

      expect(res.body.tempPassword).toEqual(expect.any(String));

      await http()
        .post(API('/auth/login'))
        .send({ login: alfa.directorEmail, password: TEST_PASSWORD })
        .expect(401);

      await http()
        .post(API('/auth/login'))
        .send({ login: alfa.directorEmail, password: res.body.tempPassword })
        .expect(200);
    });

    it("parol tiklanganda Telegram bog'lanishlari bekor qilinadi", async () => {
      const employee = await prisma.raw.employee.findFirstOrThrow({
        where: { companyId: alfa.companyId, user: { email: alfa.workerEmail } },
      });
      const user = await prisma.raw.user.findFirstOrThrow({
        where: { employeeId: employee.id },
      });

      await prisma.raw.telegramAccountLink.create({
        data: {
          telegramId: BigInt(123456789),
          userId: user.id,
          companyId: alfa.companyId,
          botId: 'platform',
          expiresAt: new Date(Date.now() + 30 * 24 * 3600_000),
        },
      });

      await http()
        .post(API(`/employees/${employee.id}/reset-password`))
        .set(...admin.header)
        .expect(201);

      const links = await prisma.raw.telegramAccountLink.findMany({
        where: { userId: user.id },
      });
      expect(links).toHaveLength(1);
      expect(links[0]?.isRevoked).toBe(true);
    });

    it('direktor ADMIN parolini tiklay olmaydi', async () => {
      const adminEmployee = await prisma.raw.employee.findFirstOrThrow({
        where: { companyId: alfa.companyId, user: { email: alfa.adminEmail } },
      });

      await http()
        .post(API(`/employees/${adminEmployee.id}/reset-password`))
        .set(...director.header)
        .expect(403);
    });
  });

  describe('nofaol qilish', () => {
    it('xodim nofaol qilinsa hisobi ham bloklanadi', async () => {
      const employee = await prisma.raw.employee.findFirstOrThrow({
        where: {
          companyId: alfa.companyId,
          user: { email: alfa.directorEmail },
        },
      });

      await http()
        .patch(API(`/employees/${employee.id}`))
        .set(...admin.header)
        .send({ status: 'INACTIVE' })
        .expect(200);

      await http()
        .post(API('/auth/login'))
        .send({ login: alfa.directorEmail, password: TEST_PASSWORD })
        .expect(403);
    });
  });

  describe("boshqa filialga ko'chirish", () => {
    it("ko'chirish tarixi saqlanadi", async () => {
      const employee = await prisma.raw.employee.findFirstOrThrow({
        where: { companyId: alfa.companyId, user: { email: alfa.workerEmail } },
      });

      const res = await http()
        .post(API(`/employees/${employee.id}/transfer`))
        .set(...admin.header)
        .send({ toBranchId: alfa.branchIds[1] })
        .expect(201);

      expect(res.body.branchId).toBe(alfa.branchIds[1]);

      const history = await http()
        .get(API(`/employees/${employee.id}/transfers`))
        .set(...admin.header)
        .expect(200);

      expect(history.body).toHaveLength(1);
      expect(history.body[0].fromBranchId).toBe(alfa.branchIds[0]);
      expect(history.body[0].toBranchId).toBe(alfa.branchIds[1]);
    });

    it("direktor ko'chira olmaydi (faqat ADMIN)", async () => {
      const employee = await prisma.raw.employee.findFirstOrThrow({
        where: { companyId: alfa.companyId, user: { email: alfa.workerEmail } },
      });

      await http()
        .post(API(`/employees/${employee.id}/transfer`))
        .set(...director.header)
        .send({ toBranchId: alfa.branchIds[1] })
        .expect(403);
    });

    it("bir xil filialga ko'chirish 409", async () => {
      const employee = await prisma.raw.employee.findFirstOrThrow({
        where: { companyId: alfa.companyId, user: { email: alfa.workerEmail } },
      });

      await http()
        .post(API(`/employees/${employee.id}/transfer`))
        .set(...admin.header)
        .send({ toBranchId: alfa.branchIds[0] })
        .expect(409);
    });
  });
});
