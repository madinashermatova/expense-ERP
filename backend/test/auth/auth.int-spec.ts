import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { createHttpApp, API } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import {
  seedCompany,
  SeededCompany,
  TEST_PASSWORD,
} from '../helpers/seed-fixtures';

describe('Auth (TZ 3.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let alfa: SeededCompany;
  let beta: SeededCompany;

  const http = () => request(app.getHttpServer() as App);

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
  });

  describe('login', () => {
    it("to'g'ri email + parol bilan kirish muvaffaqiyatli", async () => {
      const res = await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: TEST_PASSWORD })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        email: alfa.adminEmail,
        role: 'ADMIN',
      });
      expect(res.body.user.companyId).toBe(alfa.companyId);
      // refresh token faqat httpOnly cookie da — javob tanasida bo'lmasligi shart
      expect(res.body.refreshToken).toBeUndefined();
      expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    });

    it('username bilan ham kirish mumkin', async () => {
      await http()
        .post(API('/auth/login'))
        .send({ login: 'alfa_admin1', password: TEST_PASSWORD })
        .expect(200);
    });

    it("noto'g'ri parolda xabar login mavjudligini oshkor qilmaydi", async () => {
      const wrongPassword = await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: 'NotoGriParol1' })
        .expect(401);

      const unknownLogin = await http()
        .post(API('/auth/login'))
        .send({ login: 'yoq@alfa.uz', password: 'NotoGriParol1' })
        .expect(401);

      expect(wrongPassword.body.message).toBe(unknownLogin.body.message);
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('ishchi roli Web ERP ga kira olmaydi (403)', async () => {
      const res = await http()
        .post(API('/auth/login'))
        .send({ login: alfa.workerEmail, password: TEST_PASSWORD })
        .expect(403);

      expect(res.body.code).toBe('WEB_ACCESS_DENIED');
    });

    it("nofaol foydalanuvchi to'g'ri parol bilan ham kira olmaydi", async () => {
      await prisma.raw.user.update({
        where: { id: alfa.adminId },
        data: { isActive: false },
      });

      const res = await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: TEST_PASSWORD })
        .expect(403);

      expect(res.body.code).toBe('ACCOUNT_INACTIVE');
    });

    it("to'xtatilgan kompaniya hisobiga kirish bloklanadi", async () => {
      await prisma.raw.company.update({
        where: { id: alfa.companyId },
        data: { status: 'SUSPENDED' },
      });

      const res = await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: TEST_PASSWORD })
        .expect(403);

      expect(res.body.code).toBe('COMPANY_SUSPENDED');
    });

    it("6-chi noto'g'ri urinishda 429 va Retry-After qaytadi", async () => {
      for (let i = 0; i < 5; i += 1) {
        await http()
          .post(API('/auth/login'))
          .send({ login: alfa.adminEmail, password: 'NotoGriParol1' })
          .expect(401);
      }

      const res = await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: 'NotoGriParol1' })
        .expect(429);

      expect(res.body.code).toBe('LOGIN_LOCKED');
      expect(res.headers['retry-after']).toBeDefined();
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it("blok holatida to'g'ri parol ham ishlamaydi", async () => {
      await prisma.raw.user.update({
        where: { id: alfa.adminId },
        data: {
          failedLoginCount: 5,
          lockedUntil: new Date(Date.now() + 15 * 60_000),
        },
      });

      await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: TEST_PASSWORD })
        .expect(429);
    });

    it('muvaffaqiyatli kirishdan keyin hisoblagich tozalanadi', async () => {
      await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: 'NotoGriParol1' })
        .expect(401);

      await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: TEST_PASSWORD })
        .expect(200);

      const user = await prisma.raw.user.findUnique({
        where: { id: alfa.adminId },
      });
      expect(user?.failedLoginCount).toBe(0);
      expect(user?.lockedUntil).toBeNull();
    });

    it("bir xil email ikki kompaniyada bo'lsa kompaniya tanlash so'raladi", async () => {
      // Ikkala kompaniyada bir xil email
      await prisma.raw.user.update({
        where: { id: beta.adminId },
        data: { email: alfa.adminEmail },
      });

      const res = await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: TEST_PASSWORD })
        .expect(409);

      expect(res.body.code).toBe('MULTIPLE_COMPANIES');

      // companySlug bilan aniqlashtirilganda muvaffaqiyatli
      const ok = await http()
        .post(API('/auth/login'))
        .send({
          login: alfa.adminEmail,
          password: TEST_PASSWORD,
          companySlug: 'beta',
        })
        .expect(200);

      expect(ok.body.user.companyId).toBe(beta.companyId);
    });

    it("parol 8 belgidan qisqa bo'lsa 422 validatsiya xatosi", async () => {
      const res = await http()
        .post(API('/auth/login'))
        .send({ login: alfa.adminEmail, password: 'qisqa' })
        .expect(422);

      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('token va sessiya', () => {
    const loginAs = async (email: string) => {
      const res = await http()
        .post(API('/auth/login'))
        .send({ login: email, password: TEST_PASSWORD })
        .expect(200);
      return {
        accessToken: res.body.accessToken as string,
        cookie: (res.headers['set-cookie'] as unknown as string[])[0],
      };
    };

    it('access token bilan /auth/me ishlaydi', async () => {
      const { accessToken } = await loginAs(alfa.adminEmail);

      const res = await http()
        .get(API('/auth/me'))
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(alfa.adminEmail);
    });

    it("tokensiz so'rov 401 qaytaradi", async () => {
      await http().get(API('/auth/me')).expect(401);
    });

    it('refresh yangi access token beradi va eski refresh bekor qilinadi (rotatsiya)', async () => {
      const { cookie } = await loginAs(alfa.adminEmail);

      const first = await http()
        .post(API('/auth/refresh'))
        .set('Cookie', cookie)
        .expect(200);
      expect(first.body.accessToken).toEqual(expect.any(String));

      // Eski cookie qayta ishlatilsa — rad etiladi
      await http().post(API('/auth/refresh')).set('Cookie', cookie).expect(401);
    });

    it('bekor qilingan refresh qayta ishlatilsa barcha sessiyalar yopiladi', async () => {
      const { cookie } = await loginAs(alfa.adminEmail);
      const second = await http()
        .post(API('/auth/refresh'))
        .set('Cookie', cookie)
        .expect(200);
      const newCookie = (
        second.headers['set-cookie'] as unknown as string[]
      )[0];

      // eski token bilan urinish → xavfsizlik chorasi
      await http().post(API('/auth/refresh')).set('Cookie', cookie).expect(401);

      // yangi token ham endi ishlamaydi
      await http()
        .post(API('/auth/refresh'))
        .set('Cookie', newCookie)
        .expect(401);
    });

    it('logout dan keyin refresh ishlamaydi', async () => {
      const { cookie } = await loginAs(alfa.adminEmail);

      await http().post(API('/auth/logout')).set('Cookie', cookie).expect(204);
      await http().post(API('/auth/refresh')).set('Cookie', cookie).expect(401);
    });

    it("bloklangan foydalanuvchining amaldagi tokeni ham darhol kuchini yo'qotadi", async () => {
      const { accessToken } = await loginAs(alfa.adminEmail);
      await prisma.raw.user.update({
        where: { id: alfa.adminId },
        data: { isActive: false },
      });

      await http()
        .get(API('/auth/me'))
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('tenant konteksti', () => {
    it("token dan kelgan companyId kontekstga o'rnatiladi", async () => {
      const res = await http()
        .post(API('/auth/login'))
        .send({ login: beta.adminEmail, password: TEST_PASSWORD })
        .expect(200);

      expect(res.body.user.companyId).toBe(beta.companyId);
      expect(res.body.user.companyName).toContain('beta');
    });
  });
});
