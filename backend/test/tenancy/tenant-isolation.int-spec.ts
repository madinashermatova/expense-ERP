import { PrismaService } from '../../src/common/prisma/prisma.service';
import { TenantContextService } from '../../src/common/tenancy/tenant-context.service';
import {
  asCompany,
  createTestContext,
  TestContext,
  truncateAll,
} from '../helpers/test-context';

/**
 * TZ 3.16.1 qabul mezoni:
 * "Prisma middleware o'chirilganda tenant izolyatsiya testi yiqiladi — ya'ni izolyatsiya
 *  qo'lda yozilgan filtrlarga emas, markazlashgan qatlamga tayanadi."
 *
 * Shu sababli barcha so'rovlar `prisma.db` (extension bilan) orqali bajariladi,
 * `prisma.raw` esa faqat boshlang'ich ma'lumot yaratish va nazorat tekshiruvlari uchun.
 */
describe('Tenant izolyatsiyasi (Prisma extension)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let tenant: TenantContextService;

  let companyA: string;
  let companyB: string;
  let branchA: string;
  let branchB: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    prisma = ctx.prisma;
    tenant = ctx.tenant;
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);

    // Boshlang'ich ma'lumot — ataylab extension siz (platforma darajasidagi amal)
    const a = await prisma.raw.company.create({
      data: { name: 'Alfa MChJ', slug: 'alfa' },
    });
    const b = await prisma.raw.company.create({
      data: { name: 'Beta MChJ', slug: 'beta' },
    });
    companyA = a.id;
    companyB = b.id;

    const ba = await prisma.raw.branch.create({
      data: { companyId: companyA, code: 'CHL', name: 'Chilonzor' },
    });
    const bb = await prisma.raw.branch.create({
      data: { companyId: companyB, code: 'YUN', name: 'Yunusobod' },
    });
    branchA = ba.id;
    branchB = bb.id;
  });

  describe('kontekst majburiyligi', () => {
    it('kontekstsiz biznes so\'rov xato beradi — hech qachon "hammasini" qaytarmaydi', async () => {
      await expect(prisma.db.branch.findMany()).rejects.toMatchObject({
        response: { code: 'TENANT_CONTEXT_MISSING' },
      });
    });

    it('kontekstsiz create ham bloklanadi', async () => {
      await expect(
        prisma.db.branch.create({
          data: { code: 'XXX', name: 'Ruxsatsiz' } as never,
        }),
      ).rejects.toMatchObject({ response: { code: 'TENANT_CONTEXT_MISSING' } });
    });

    it('platforma jadvallari (Company) kontekstsiz ishlaydi — allow-list', async () => {
      const companies = await prisma.db.company.findMany();
      expect(companies).toHaveLength(2);
    });
  });

  describe("o'qish izolyatsiyasi", () => {
    it("findMany faqat o'z kompaniyasi yozuvlarini qaytaradi", async () => {
      const forA = await asCompany(tenant, companyA, () =>
        prisma.db.branch.findMany(),
      );
      const forB = await asCompany(tenant, companyB, () =>
        prisma.db.branch.findMany(),
      );

      expect(forA.map((b) => b.code)).toEqual(['CHL']);
      expect(forB.map((b) => b.code)).toEqual(['YUN']);
    });

    it("findUnique boshqa kompaniya yozuvini id bo'yicha ham topa olmaydi (404 asosi)", async () => {
      const found = await asCompany(tenant, companyA, () =>
        prisma.db.branch.findUnique({ where: { id: branchB } }),
      );
      expect(found).toBeNull();
    });

    it('findUniqueOrThrow boshqa kompaniya yozuvida xato beradi', async () => {
      await expect(
        asCompany(tenant, companyA, () =>
          prisma.db.branch.findUniqueOrThrow({ where: { id: branchB } }),
        ),
      ).rejects.toThrow();
    });

    it("count faqat o'z kompaniyasini sanaydi", async () => {
      const countA = await asCompany(tenant, companyA, () =>
        prisma.db.branch.count(),
      );
      expect(countA).toBe(1);
    });

    it("boshqa kompaniyaning companyId si qo'lda berilsa ham natija bermaydi", async () => {
      const leaked = await asCompany(tenant, companyA, () =>
        prisma.db.branch.findMany({ where: { companyId: companyB } }),
      );
      expect(leaked).toHaveLength(0);
    });
  });

  describe('yozish izolyatsiyasi', () => {
    it("create da companyId avtomatik to'ldiriladi", async () => {
      const created = await asCompany(tenant, companyA, () =>
        prisma.db.branch.create({
          data: { code: 'SRG', name: 'Sergeli' } as never,
        }),
      );
      expect(created.companyId).toBe(companyA);
    });

    it('boshqa kompaniyaning companyId si bilan create qilish bloklanadi', async () => {
      await expect(
        asCompany(tenant, companyA, () =>
          prisma.db.branch.create({
            data: { companyId: companyB, code: 'HCK', name: 'Hujum' },
          }),
        ),
      ).rejects.toMatchObject({ response: { code: 'CROSS_TENANT_WRITE' } });
    });

    it("update boshqa kompaniya yozuviga ta'sir qilmaydi", async () => {
      await expect(
        asCompany(tenant, companyA, () =>
          prisma.db.branch.update({
            where: { id: branchB },
            data: { name: "O'g'irlangan" },
          }),
        ),
      ).rejects.toThrow();

      const untouched = await prisma.raw.branch.findUnique({
        where: { id: branchB },
      });
      expect(untouched?.name).toBe('Yunusobod');
    });

    it("updateMany boshqa kompaniya yozuvlarini o'zgartirmaydi", async () => {
      const result = await asCompany(tenant, companyA, () =>
        prisma.db.branch.updateMany({ data: { name: 'Ommaviy nom' } }),
      );
      expect(result.count).toBe(1);

      const b = await prisma.raw.branch.findUnique({ where: { id: branchB } });
      expect(b?.name).toBe('Yunusobod');
    });

    it("deleteMany boshqa kompaniya yozuvlarini o'chirmaydi", async () => {
      await asCompany(tenant, companyA, () => prisma.db.branch.deleteMany({}));

      const remaining = await prisma.raw.branch.findMany();
      expect(remaining.map((b) => b.code)).toEqual(['YUN']);
    });
  });

  describe('unscoped rejim', () => {
    it("runUnscoped tenant filtrini ataylab chetlab o'tadi (login, seed uchun)", async () => {
      const all = await tenant.runAsync({ companyId: companyA }, () =>
        tenant.runUnscoped("test: barcha filiallarni ko'rish", () =>
          prisma.db.branch.findMany(),
        ),
      );
      expect(all).toHaveLength(2);
    });
  });

  describe('izolyatsiya manbai', () => {
    it("extension siz (raw) so'rov ikkala kompaniyani qaytaradi — ya'ni himoya aynan extension da", async () => {
      const viaRaw = await asCompany(tenant, companyA, () =>
        prisma.raw.branch.findMany(),
      );
      const viaDb = await asCompany(tenant, companyA, () =>
        prisma.db.branch.findMany(),
      );

      expect(viaRaw).toHaveLength(2);
      expect(viaDb).toHaveLength(1);
    });
  });

  describe("bog'liq jadvallar", () => {
    it("xodim va kategoriya ham tenant bo'yicha ajratiladi", async () => {
      await prisma.raw.employee.create({
        data: {
          companyId: companyA,
          fullName: 'Aliyev Vali',
          branchId: branchA,
        },
      });
      await prisma.raw.employee.create({
        data: {
          companyId: companyB,
          fullName: 'Beta Xodim',
          branchId: branchB,
        },
      });

      const employeesA = await asCompany(tenant, companyA, () =>
        prisma.db.employee.findMany(),
      );
      expect(employeesA.map((e) => e.fullName)).toEqual(['Aliyev Vali']);
    });

    it('aggregate va groupBy ham cheklanadi', async () => {
      const grouped = await asCompany(tenant, companyA, () =>
        prisma.db.branch.groupBy({ by: ['companyId'], _count: { _all: true } }),
      );
      expect(grouped).toHaveLength(1);
      expect(grouped[0]?.companyId).toBe(companyA);
    });
  });
});
