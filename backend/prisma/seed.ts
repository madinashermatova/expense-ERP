/* eslint-disable no-console */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { Currency, Language, RateSource, Role } from '../src/generated/prisma/enums';
import { DEFAULT_CATEGORY_TREE } from '../src/modules/categories/default-categories';

/**
 * TZ 7 — seed skripti: 2 kompaniya (tenant izolyatsiyani isbotlash uchun), har birida
 * 2 bosh admin, 2 filial (kodlari bilan), 2 direktor, 5 ishchi, kategoriyalar daraxti,
 * boshlang'ich valyuta kursi va DEFAULT tarif.
 *
 * Seed ataylab extension siz (raw) client bilan ishlaydi — tenant konteksti hali yo'q.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEV_PASSWORD = 'Parol123!';

interface CompanySpec {
  name: string;
  slug: string;
  branches: { code: string; name: string }[];
  emailDomain: string;
}

const COMPANIES: CompanySpec[] = [
  {
    name: 'Alfa Savdo MChJ',
    slug: 'alfa',
    emailDomain: 'alfa.uz',
    branches: [
      { code: 'CHL', name: 'Chilonzor' },
      { code: 'YUN', name: 'Yunusobod' },
    ],
  },
  {
    name: 'Beta Logistika MChJ',
    slug: 'beta',
    emailDomain: 'beta.uz',
    branches: [
      { code: 'MRZ', name: 'Mirzo Ulug‘bek' },
      { code: 'SRG', name: 'Sergeli' },
    ],
  },
];

async function main(): Promise<void> {
  console.log('Seed boshlandi…');

  const passwordHash = await argon2.hash(DEV_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  // ── Tarif (TZ 3.16.4) — DEFAULT limitsiz
  const plan = await prisma.plan.upsert({
    where: { code: 'DEFAULT' },
    update: {},
    create: {
      code: 'DEFAULT',
      name: 'Standart (cheksiz)',
      maxBranches: null,
      maxEmployees: null,
    },
  });

  // ── Platforma egasi (kompaniyaga tegishli emas)
  await prisma.user.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      companyId: null,
      email: 'owner@platform.local',
      username: 'owner',
      passwordHash,
      role: Role.PLATFORM_OWNER,
    },
  });
  console.log('  PLATFORM_OWNER: owner@platform.local');

  for (const spec of COMPANIES) {
    const company = await prisma.company.upsert({
      where: { slug: spec.slug },
      update: {},
      create: {
        name: spec.name,
        slug: spec.slug,
        timezone: 'Asia/Tashkent',
        defaultLanguage: Language.UZ,
      },
    });

    await prisma.companySubscription.create({
      data: { companyId: company.id, planId: plan.id },
    });

    console.log(`\n  ${spec.name} (${spec.slug})`);

    // ── Filiallar
    const branches = [];
    for (const b of spec.branches) {
      branches.push(
        await prisma.branch.create({
          data: { companyId: company.id, code: b.code, name: b.name, openedAt: new Date('2024-01-15') },
        }),
      );
    }
    console.log(`    filiallar: ${branches.map((b) => b.code).join(', ')}`);

    // ── Kategoriyalar daraxti
    let categoryCount = 0;
    for (const [i, parent] of DEFAULT_CATEGORY_TREE.entries()) {
      const created = await prisma.category.create({
        data: {
          companyId: company.id,
          nameUz: parent.uz,
          nameRu: parent.ru,
          commentRequired: parent.commentRequired ?? false,
          receiptRequired: parent.receiptRequired ?? false,
          sortOrder: i,
        },
      });
      categoryCount += 1;
      for (const [j, child] of (parent.children ?? []).entries()) {
        await prisma.category.create({
          data: {
            companyId: company.id,
            parentId: created.id,
            nameUz: child.uz,
            nameRu: child.ru,
            receiptRequired: child.receiptRequired ?? false,
            commentRequired: child.commentRequired ?? false,
            sortOrder: j,
          },
        });
        categoryCount += 1;
      }
    }
    console.log(`    kategoriyalar: ${categoryCount}`);

    // ── 2 bosh admin (four-eyes qoidasi ishlashi uchun kamida ikkitasi kerak)
    for (let i = 1; i <= 2; i += 1) {
      const employee = await prisma.employee.create({
        data: {
          companyId: company.id,
          fullName: `${spec.slug === 'alfa' ? 'Alimov' : 'Bekmurodov'} Admin ${i}`,
          position: 'Moliya direktori',
          branchId: branches[0]!.id,
          phone: `+9989${spec.slug === 'alfa' ? '0' : '1'}000000${i}`,
        },
      });
      await prisma.user.create({
        data: {
          companyId: company.id,
          email: `admin${i}@${spec.emailDomain}`,
          username: `${spec.slug}_admin${i}`,
          passwordHash,
          role: Role.ADMIN,
          employeeId: employee.id,
        },
      });
    }
    console.log(`    adminlar: admin1@${spec.emailDomain}, admin2@${spec.emailDomain}`);

    // ── Har filialga bitta direktor
    for (const [i, branch] of branches.entries()) {
      const employee = await prisma.employee.create({
        data: {
          companyId: company.id,
          fullName: `${branch.name} direktori`,
          position: 'Filial direktori',
          branchId: branch.id,
          phone: `+9989${spec.slug === 'alfa' ? '0' : '1'}111111${i}`,
        },
      });
      await prisma.user.create({
        data: {
          companyId: company.id,
          email: `director.${branch.code.toLowerCase()}@${spec.emailDomain}`,
          username: `${spec.slug}_dir_${branch.code.toLowerCase()}`,
          passwordHash,
          role: Role.DIRECTOR,
          employeeId: employee.id,
        },
      });
    }
    console.log(
      `    direktorlar: ${branches.map((b) => `director.${b.code.toLowerCase()}@${spec.emailDomain}`).join(', ')}`,
    );

    // ── 5 ishchi (filiallar bo'yicha taqsimlangan)
    for (let i = 1; i <= 5; i += 1) {
      const branch = branches[i % branches.length]!;
      const employee = await prisma.employee.create({
        data: {
          companyId: company.id,
          fullName: `${spec.slug === 'alfa' ? 'Aliyev' : 'Bobojonov'} Ishchi ${i}`,
          position: 'Mutaxassis',
          branchId: branch.id,
          phone: `+9989${spec.slug === 'alfa' ? '0' : '1'}222222${i}`,
        },
      });
      await prisma.user.create({
        data: {
          companyId: company.id,
          email: `worker${i}@${spec.emailDomain}`,
          username: `${spec.slug}_worker${i}`,
          passwordHash,
          role: Role.WORKER,
          employeeId: employee.id,
        },
      });
    }
    console.log(`    ishchilar: worker1..5@${spec.emailDomain}`);

    // ── Boshlang'ich valyuta kursi (TZ 3.5)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await prisma.currencyRate.create({
      data: {
        companyId: company.id,
        date: today,
        currency: Currency.USD,
        rate: '12650.000000',
        source: RateSource.MANUAL,
      },
    });

    // ── Sozlamalar
    await prisma.setting.createMany({
      data: [
        { companyId: company.id, key: 'currency.base', value: { mode: 'MANUAL' } },
        { companyId: company.id, key: 'report.periodStartDay', value: { day: 1 } },
        { companyId: company.id, key: 'approval.reminderHours', value: { hours: 24 } },
        { companyId: company.id, key: 'expense.editWindowHours', value: { hours: 24 } },
      ],
    });
  }

  console.log(`\nSeed tugadi. Barcha hisoblar uchun parol: ${DEV_PASSWORD}`);
}

main()
  .catch((e: unknown) => {
    console.error('Seed xatosi:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
