import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { TenancyModule } from '../../src/common/tenancy/tenancy.module';
import { PrismaModule } from '../../src/common/prisma/prisma.module';
import { TenantContextService } from '../../src/common/tenancy/tenant-context.service';
import { validateEnv } from '../../src/config/env.validation';
import { Role } from '../../src/generated/prisma/enums';

export interface TestContext {
  module: TestingModule;
  prisma: PrismaService;
  tenant: TenantContextService;
  close: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        cache: false,
        validate: validateEnv,
      }),
      TenancyModule,
      PrismaModule,
    ],
  }).compile();

  await module.init();

  const prisma = module.get(PrismaService);
  const tenant = module.get(TenantContextService);

  return {
    module,
    prisma,
    tenant,
    close: async () => {
      await module.close();
    },
  };
}

/** Barcha jadvallarni tozalaydi (migratsiya jadvalidan tashqari) */
export async function truncateAll(prisma: PrismaService): Promise<void> {
  const tables = await prisma.raw.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.raw.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

/** Kontekst ichida bajarish uchun qisqartma */
export function asCompany<T>(
  tenant: TenantContextService,
  companyId: string,
  fn: () => Promise<T>,
  extra: { userId?: string; role?: Role; branchId?: string } = {},
): Promise<T> {
  // DIQQAT: Prisma promise lazy — so'rov `.then` chaqirilganda boshlanadi.
  // Shuning uchun `await` aynan ALS konteksti ichida bo'lishi shart.
  return tenant.run(
    {
      companyId,
      userId: extra.userId ?? null,
      role: extra.role ?? Role.ADMIN,
      branchId: extra.branchId ?? null,
    },
    async () => await fn(),
  );
}
