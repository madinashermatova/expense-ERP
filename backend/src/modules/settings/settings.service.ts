import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import { Prisma, RateSource } from '../../generated/prisma/client';

/**
 * Kompaniya sozlamalari (TZ 3.15). To'liq CRUD va UI S15 da; bu yerda boshqa modullar
 * uchun kerak bo'ladigan o'qish/yozish va kesh.
 */
export const SETTING_KEYS = {
  /** Valyuta hisob bazasi: AUTO (CBU) yoki MANUAL (TZ 3.5) */
  currencyBase: 'currency.base',
  /** Hisobot davri boshlanish kuni, 1–28 (TZ 3.13) */
  reportPeriodStartDay: 'report.periodStartDay',
  /** Javobsiz ariza eslatmasi, soat (TZ 3.7) */
  approvalReminderHours: 'approval.reminderHours',
  /** Tasdiqlangandan keyin tahrirlash oynasi, soat (TZ 3.8) */
  expenseEditWindowHours: 'expense.editWindowHours',
} as const;

const DEFAULTS: Record<string, unknown> = {
  [SETTING_KEYS.currencyBase]: { mode: RateSource.AUTO },
  [SETTING_KEYS.reportPeriodStartDay]: { day: 1 },
  [SETTING_KEYS.approvalReminderHours]: { hours: 24 },
  [SETTING_KEYS.expenseEditWindowHours]: { hours: 24 },
};

@Injectable()
export class SettingsService {
  /** `${companyId}:${key}` → qiymat. Sozlama o'zgarganda invalidatsiya qilinadi (TZ 3.15) */
  private readonly cache = new Map<string, unknown>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async get<T>(key: string): Promise<T> {
    const companyId = this.tenantContext.requireCompanyId('Setting', 'read');
    const cacheKey = `${companyId}:${key}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) as T;
    }

    const row = await this.prisma.db.setting.findUnique({
      where: { companyId_key: { companyId, key } },
    });

    const value = (row?.value ?? DEFAULTS[key]) as T;
    this.cache.set(cacheKey, value);
    return value;
  }

  async set(key: string, value: Prisma.InputJsonValue): Promise<void> {
    const companyId = this.tenantContext.requireCompanyId('Setting', 'write');

    await this.prisma.db.setting.upsert({
      where: { companyId_key: { companyId, key } },
      create: tenantData<Prisma.SettingUncheckedCreateInput>({
        key,
        value,
        updatedByUserId: this.tenantContext.userId,
      }),
      update: { value, updatedByUserId: this.tenantContext.userId },
    });

    this.cache.delete(`${companyId}:${key}`);
  }

  /** TZ 3.5 — hisoblash bazasi: AUTO (CBU) yoki MANUAL */
  async currencyBase(): Promise<RateSource> {
    const value = await this.get<{ mode: RateSource }>(
      SETTING_KEYS.currencyBase,
    );
    return value?.mode ?? RateSource.AUTO;
  }

  async all(): Promise<Record<string, unknown>> {
    const companyId = this.tenantContext.requireCompanyId('Setting', 'read');
    const rows = await this.prisma.db.setting.findMany();
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const result = { ...DEFAULTS, ...stored };
    for (const [key, value] of Object.entries(result)) {
      this.cache.set(`${companyId}:${key}`, value);
    }
    return result;
  }

  /** Testlar va sozlama tashqaridan o'zgartirilgan holatlar uchun */
  clearCache(): void {
    this.cache.clear();
  }
}
