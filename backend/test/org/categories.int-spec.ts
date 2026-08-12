import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';
import {
  countDefaultCategories,
  DEFAULT_CATEGORY_TREE,
} from '../../src/modules/categories/default-categories';

describe('Kategoriyalar (TZ 3.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let alfa: SeededCompany;
  let admin: Session;
  let director: Session;
  let parentId: string;
  let childId: string;

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
    admin = await loginAs(app, alfa.adminEmail);
    director = await loginAs(app, alfa.directorEmail);

    const parent = await prisma.raw.category.create({
      data: {
        companyId: alfa.companyId,
        nameUz: 'Ovqatlanish',
        nameRu: 'Питание',
      },
    });
    const child = await prisma.raw.category.create({
      data: {
        companyId: alfa.companyId,
        parentId: parent.id,
        nameUz: 'Tushlik',
        nameRu: 'Обед',
        receiptRequired: true,
      },
    });
    parentId = parent.id;
    childId = child.id;
  });

  it("daraxt ko'rinishida qaytadi (2 daraja)", async () => {
    const res = await http()
      .get(API('/categories'))
      .set(...admin.header)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].nameUz).toBe('Ovqatlanish');
    expect(res.body[0].children).toHaveLength(1);
    expect(res.body[0].children[0].receiptRequired).toBe(true);
  });

  it("direktor kategoriyalarni ko'ra oladi, lekin yarata olmaydi", async () => {
    await http()
      .get(API('/categories'))
      .set(...director.header)
      .expect(200);

    await http()
      .post(API('/categories'))
      .set(...director.header)
      .send({ nameUz: 'Yangi', nameRu: 'Новый' })
      .expect(403);
  });

  it('uchinchi daraja yaratish 422 qaytaradi', async () => {
    const res = await http()
      .post(API('/categories'))
      .set(...admin.header)
      .send({ parentId: childId, nameUz: 'Uchinchi', nameRu: 'Третий' })
      .expect(422);

    expect(res.body.code).toBe('CATEGORY_DEPTH_EXCEEDED');
  });

  it('maxAmountPerEntry va bayroqlar saqlanadi', async () => {
    const res = await http()
      .post(API('/categories'))
      .set(...admin.header)
      .send({
        parentId,
        nameUz: 'Korporativ',
        nameRu: 'Корпоратив',
        receiptRequired: true,
        commentRequired: true,
        maxAmountPerEntry: '500000.00',
      })
      .expect(201);

    expect(res.body.maxAmountPerEntry).toBe('500000');
    expect(res.body.receiptRequired).toBe(true);
    expect(res.body.commentRequired).toBe(true);
  });

  it('bosh kategoriya arxivlanganda ichkilari ham arxivlanadi', async () => {
    await http()
      .post(API(`/categories/${parentId}/archive`))
      .set(...admin.header)
      .expect(201);

    const child = await prisma.raw.category.findUnique({
      where: { id: childId },
    });
    expect(child?.status).toBe('ARCHIVED');

    const active = await http()
      .get(API('/categories?status=active'))
      .set(...admin.header)
      .expect(200);
    expect(active.body).toHaveLength(0);
  });

  it("bosh kategoriya arxivlangan bo'lsa ichkisini tiklab bo'lmaydi", async () => {
    await http()
      .post(API(`/categories/${parentId}/archive`))
      .set(...admin.header)
      .expect(201);

    const res = await http()
      .post(API(`/categories/${childId}/restore`))
      .set(...admin.header)
      .expect(409);

    expect(res.body.code).toBe('PARENT_CATEGORY_ARCHIVED');
  });

  it("ishlatilmagan kategoriyani o'chirish mumkin", async () => {
    await http()
      .delete(API(`/categories/${childId}`))
      .set(...admin.header)
      .expect(204);

    const row = await prisma.raw.category.findUnique({
      where: { id: childId },
    });
    expect(row).toBeNull();
  });

  it("ichki kategoriyasi bor kategoriyani o'chirib bo'lmaydi", async () => {
    const res = await http()
      .delete(API(`/categories/${parentId}`))
      .set(...admin.header)
      .expect(409);

    expect(res.body.code).toBe('CATEGORY_HAS_CHILDREN');
  });

  it('boshqa kompaniya kategoriyasi 404 (tenant izolyatsiyasi)', async () => {
    const beta = await seedCompany(prisma, 'beta', 'beta.uz');
    const betaCategory = await prisma.raw.category.create({
      data: { companyId: beta.companyId, nameUz: 'Beta', nameRu: 'Бета' },
    });

    await http()
      .get(API(`/categories/${betaCategory.id}`))
      .set(...admin.header)
      .expect(404);
  });

  describe('standart to‘plam (TZ 3.4)', () => {
    /** Yangi kompaniya: kategoriyalar hali yaratilmagan */
    const emptyCompany = async () => {
      const beta = await seedCompany(prisma, 'beta', 'beta.uz');
      await prisma.raw.category.deleteMany({
        where: { companyId: beta.companyId },
      });
      return {
        company: beta,
        session: await loginAs(app, beta.adminEmail),
      };
    };

    it('bo‘sh kompaniyaga standart daraxtni yuklaydi', async () => {
      const { company, session } = await emptyCompany();

      const res = await http()
        .post(API('/categories/apply-defaults'))
        .set(...session.header)
        .expect(201);

      expect(res.body.created).toBe(countDefaultCategories());

      const rows = await prisma.raw.category.findMany({
        where: { companyId: company.companyId },
      });
      expect(rows).toHaveLength(countDefaultCategories());
      // Ikki daraja: bosh kategoriyalar va ularning ichkilari
      expect(rows.filter((row) => row.parentId === null)).toHaveLength(
        DEFAULT_CATEGORY_TREE.length,
      );
      // Qoidalar ham ko‘chadi: chek majburiy bo‘lgan kategoriyalar bor
      expect(rows.some((row) => row.receiptRequired)).toBe(true);
      expect(rows.some((row) => row.commentRequired)).toBe(true);
    });

    it('ikkinchi chaqiruv dublikat yasamaydi (idempotent)', async () => {
      const { company, session } = await emptyCompany();

      await http()
        .post(API('/categories/apply-defaults'))
        .set(...session.header)
        .expect(201);
      const second = await http()
        .post(API('/categories/apply-defaults'))
        .set(...session.header)
        .expect(201);

      expect(second.body.created).toBe(0);
      const count = await prisma.raw.category.count({
        where: { companyId: company.companyId },
      });
      expect(count).toBe(countDefaultCategories());
    });

    it('kategoriyasi bor kompaniyada hech narsa o‘zgarmaydi', async () => {
      const before = await prisma.raw.category.count({
        where: { companyId: alfa.companyId },
      });

      const res = await http()
        .post(API('/categories/apply-defaults'))
        .set(...admin.header)
        .expect(201);

      expect(res.body.created).toBe(0);
      const after = await prisma.raw.category.count({
        where: { companyId: alfa.companyId },
      });
      expect(after).toBe(before);
    });

    it('direktor standart to‘plamni yuklay olmaydi', async () => {
      const res = await http()
        .post(API('/categories/apply-defaults'))
        .set(...director.header)
        .expect(403);

      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('boshqa kompaniyaning daraxtiga tegmaydi (tenant izolyatsiyasi)', async () => {
      const { company, session } = await emptyCompany();

      await http()
        .post(API('/categories/apply-defaults'))
        .set(...session.header)
        .expect(201);

      const alfaCount = await prisma.raw.category.count({
        where: { companyId: alfa.companyId },
      });
      const betaCount = await prisma.raw.category.count({
        where: { companyId: company.companyId },
      });
      expect(alfaCount).toBe(2);
      expect(betaCount).toBe(countDefaultCategories());
    });
  });
});
