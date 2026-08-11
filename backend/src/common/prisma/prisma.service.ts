import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { EnvironmentVariables } from '../../config/env.validation';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { createTenantExtension } from '../tenancy/tenant.extension';

export type TenantPrismaClient = ReturnType<PrismaService['buildClient']>;

/**
 * Yagona Prisma kirish nuqtasi.
 *
 * `db` — tenant extension bilan o'ralgan client. **Barcha servislar shuni ishlatadi.**
 * `raw` — extension siz asosiy client. Faqat migratsiya, seed va platforma amallari uchun;
 *   ishlatilgan har bir joy izohda asoslanishi shart.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly base: PrismaClient;
  readonly db: TenantPrismaClient;

  constructor(
    private readonly tenantContext: TenantContextService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    // Prisma 7 — Rust engine o'rniga driver adapter (node-postgres)
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
    });
    this.base = new PrismaClient({ adapter });
    this.db = this.buildClient();
  }

  private buildClient() {
    return this.base.$extends(createTenantExtension(this.tenantContext));
  }

  /**
   * Tenant filtridan tashqaridagi client. Ataylab ochiq qoldirilgan —
   * login (companyId hali noma'lum), seed, platforma amallari uchun.
   */
  get raw(): PrismaClient {
    return this.base;
  }

  async onModuleInit(): Promise<void> {
    await this.base.$connect();
    this.logger.log('Prisma ulandi');
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect();
  }
}
