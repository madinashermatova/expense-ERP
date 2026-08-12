import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

describe('Filiallar (TZ 3.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let alfa: SeededCompany;
  let beta: SeededCompany;
  let admin: Session;
  let director: Session;

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
    admin = await loginAs(app, alfa.adminEmail);
    director = await loginAs(app, alfa.directorEmail);
  });

  describe('yaratish', () => {
    it('admin filial yarata oladi', async () => {
      const res = await http()
        .post(API('/branches'))
        .set(...admin.header)
        .send({ code: 'chl', name: 'Chilonzor', phone: '+998901112233' })
        .expect(201);

      // kod avtomatik katta harfga o'tadi
      expect(res.body.code).toBe('CHL');
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.hasNoDirector).toBe(true);
    });

    it("direktor filial yaratmoqchi bo'lsa 403", async () => {
      await http()
        .post(API('/branches'))
        .set(...director.header)
        .send({ code: 'XXX', name: 'Ruxsatsiz' })
        .expect(403);
    });

    it("kod formati noto'g'ri bo'lsa 422", async () => {
      await http()
        .post(API('/branches'))
        .set(...admin.header)
        .send({ code: 'A1', name: 'Xato kod' })
        .expect(422);
    });

    it('takrorlanuvchi kod 409 qaytaradi', async () => {
      const res = await http()
        .post(API('/branches'))
        .set(...admin.header)
        .send({ code: 'AAA', name: 'Takror' })
        .expect(409);

      expect(res.body.code).toBe('BRANCH_CODE_TAKEN');
    });

    it('bir xil kod boshqa kompaniyada muammosiz yaratiladi (tenant doirasidagi unikallik)', async () => {
      const betaAdmin = await loginAs(app, beta.adminEmail);

      await http()
        .post(API('/branches'))
        .set(...betaAdmin.header)
        .send({ code: 'CCC', name: 'Beta filial' })
        .expect(201);

      await http()
        .post(API('/branches'))
        .set(...admin.header)
        .send({ code: 'CCC', name: 'Alfa filial' })
        .expect(201);
    });
  });

  describe("ro'yxat va doira", () => {
    it("admin barcha filiallarni ko'radi", async () => {
      const res = await http()
        .get(API('/branches'))
        .set(...admin.header)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it("direktor faqat o'z filialini ko'radi", async () => {
      const res = await http()
        .get(API('/branches'))
        .set(...director.header)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(alfa.branchIds[0]);
    });

    it("direktor boshqa filialni id bo'yicha so'rasa 404", async () => {
      await http()
        .get(API(`/branches/${alfa.branchIds[1]}`))
        .set(...director.header)
        .expect(404);
    });

    it('boshqa kompaniya filiali 404 qaytaradi (tenant izolyatsiyasi)', async () => {
      await http()
        .get(API(`/branches/${beta.branchIds[0]}`))
        .set(...admin.header)
        .expect(404);
    });

    it('status filtri ishlaydi', async () => {
      await http()
        .post(API(`/branches/${alfa.branchIds[1]}/archive`))
        .set(...admin.header)
        .expect(201);

      const active = await http()
        .get(API('/branches?status=active'))
        .set(...admin.header)
        .expect(200);
      const archived = await http()
        .get(API('/branches?status=archived'))
        .set(...admin.header)
        .expect(200);
      const all = await http()
        .get(API('/branches?status=all'))
        .set(...admin.header)
        .expect(200);

      expect(active.body.items).toHaveLength(1);
      expect(archived.body.items).toHaveLength(1);
      expect(all.body.items).toHaveLength(2);
    });
  });

  describe('tahrirlash va arxivlash', () => {
    it("filial kodi o'zgartirilmaydi (DTO da qabul qilinmaydi)", async () => {
      await http()
        .patch(API(`/branches/${alfa.branchIds[0]}`))
        .set(...admin.header)
        .send({ code: 'ZZZ' })
        .expect(422);
    });

    it("arxivlash fizik o'chirmaydi", async () => {
      await http()
        .post(API(`/branches/${alfa.branchIds[0]}/archive`))
        .set(...admin.header)
        .expect(201);

      const row = await prisma.raw.branch.findUnique({
        where: { id: alfa.branchIds[0] },
      });
      expect(row).not.toBeNull();
      expect(row?.status).toBe('ARCHIVED');
    });

    it('ikki marta arxivlash 409', async () => {
      await http()
        .post(API(`/branches/${alfa.branchIds[0]}/archive`))
        .set(...admin.header)
        .expect(201);

      await http()
        .post(API(`/branches/${alfa.branchIds[0]}/archive`))
        .set(...admin.header)
        .expect(409);
    });

    it('arxivlangan filialni tiklash mumkin', async () => {
      await http()
        .post(API(`/branches/${alfa.branchIds[0]}/archive`))
        .set(...admin.header)
        .expect(201);

      const res = await http()
        .post(API(`/branches/${alfa.branchIds[0]}/restore`))
        .set(...admin.header)
        .expect(201);

      expect(res.body.status).toBe('ACTIVE');
    });
  });

  describe('direktorsiz filial ogohlantirishi', () => {
    it('direktori bor filialda hasNoDirector = false', async () => {
      const res = await http()
        .get(API(`/branches/${alfa.branchIds[0]}`))
        .set(...admin.header)
        .expect(200);

      expect(res.body.directorCount).toBe(1);
      expect(res.body.hasNoDirector).toBe(false);
    });

    it("direktori yo'q filialda hasNoDirector = true", async () => {
      const res = await http()
        .get(API(`/branches/${alfa.branchIds[1]}`))
        .set(...admin.header)
        .expect(200);

      expect(res.body.hasNoDirector).toBe(true);
    });
  });

  describe('tarif limiti (TZ 3.16.4)', () => {
    it("DEFAULT tarifda (limit null) ko'p filial yaratish mumkin", async () => {
      for (const code of ['DD', 'EE', 'FF', 'GG']) {
        await http()
          .post(API('/branches'))
          .set(...admin.header)
          .send({ code, name: `Filial ${code}` })
          .expect(201);
      }
    });

    it('maxBranches=3 tarifida 4-chi filial 403 PLAN_LIMIT_EXCEEDED', async () => {
      const plan = await prisma.raw.plan.create({
        data: {
          code: `LIMITED_${Date.now()}`,
          name: 'Cheklangan',
          maxBranches: 3,
        },
      });
      await prisma.raw.companySubscription.create({
        data: { companyId: alfa.companyId, planId: plan.id },
      });

      // Hozir 2 ta filial bor → uchinchisi o'tadi
      await http()
        .post(API('/branches'))
        .set(...admin.header)
        .send({ code: 'TRE', name: 'Uchinchi' })
        .expect(201);

      const res = await http()
        .post(API('/branches'))
        .set(...admin.header)
        .send({ code: 'FOR', name: "To'rtinchi" })
        .expect(403);

      expect(res.body.code).toBe('PLAN_LIMIT_EXCEEDED');
    });
  });
});
