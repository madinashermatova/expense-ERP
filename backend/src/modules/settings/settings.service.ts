import { Injectable } from '@nestjs/common';
import { AuditChange, AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { tenantData } from '../../common/tenancy/tenant-data';
import { Language, Prisma, RateSource } from '../../generated/prisma/client';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/** Sozlamalarning mijozga chiqadigan tekis shakli (TZ 3.15) */
export interface SettingsView {
  currencyBase: RateSource;
  reportPeriodStartDay: number;
  approvalReminderHours: number;
  expenseEditWindowHours: number;
  defaultLanguage: Language;
  workDays: number[];
  notificationsEnabled: boolean;
}

/**
 * Kompaniya sozlamalari (TZ 3.15).
 *
 * Kalitlar `settings` jadvalida `{ companyId, key }` bo'yicha saqlanadi; qiymat — JSON,
 * chunki har bir sozlamaning o'z shakli bor. Tashqi dunyoga (`SettingsController`)
 * tekis shakl chiqadi, kalit nomlari va JSON tuzilishi shu faylda qoladi.
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
  /** Kompaniyaning standart tili (TZ 3.15) */
  defaultLanguage: 'company.defaultLanguage',
  /** Ish kunlari: 1 — dushanba … 7 — yakshanba (TZ 3.15) */
  workDays: 'company.workDays',
  /** Bildirishnomalar yoqilganmi (TZ 3.11, 3.15) */
  notificationsEnabled: 'notifications.enabled',
} as const;

const DEFAULTS: Record<string, unknown> = {
  [SETTING_KEYS.currencyBase]: { mode: RateSource.AUTO },
  [SETTING_KEYS.reportPeriodStartDay]: { day: 1 },
  [SETTING_KEYS.approvalReminderHours]: { hours: 24 },
  [SETTING_KEYS.expenseEditWindowHours]: { hours: 24 },
  [SETTING_KEYS.defaultLanguage]: { language: Language.UZ },
  [SETTING_KEYS.workDays]: { days: [1, 2, 3, 4, 5, 6] },
  [SETTING_KEYS.notificationsEnabled]: { enabled: true },
};

@Injectable()
export class SettingsService {
  /** `${companyId}:${key}` → qiymat. Sozlama o'zgarganda invalidatsiya qilinadi (TZ 3.15) */
  private readonly cache = new Map<string, unknown>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

  /** TZ 3.11 — bildirishnomalar butun kompaniya bo'yicha o'chirilgan bo'lishi mumkin */
  async notificationsEnabled(): Promise<boolean> {
    const value = await this.get<{ enabled: boolean }>(
      SETTING_KEYS.notificationsEnabled,
    );
    return value?.enabled ?? true;
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

  // ───────────────────────────────────────────────────────────────────────────
  // Sozlamalar ekrani (TZ 3.15)
  // ───────────────────────────────────────────────────────────────────────────

  /** Mijozga tekis shakl chiqadi — kalit nomlari va JSON tuzilishi shu faylda qoladi */
  async view(): Promise<SettingsView> {
    const all = await this.all();
    const value = <T>(key: string): T => all[key] as T;

    return {
      currencyBase: value<{ mode: RateSource }>(SETTING_KEYS.currencyBase).mode,
      reportPeriodStartDay: value<{ day: number }>(
        SETTING_KEYS.reportPeriodStartDay,
      ).day,
      approvalReminderHours: value<{ hours: number }>(
        SETTING_KEYS.approvalReminderHours,
      ).hours,
      expenseEditWindowHours: value<{ hours: number }>(
        SETTING_KEYS.expenseEditWindowHours,
      ).hours,
      defaultLanguage: value<{ language: Language }>(
        SETTING_KEYS.defaultLanguage,
      ).language,
      workDays: value<{ days: number[] }>(SETTING_KEYS.workDays).days,
      notificationsEnabled: value<{ enabled: boolean }>(
        SETTING_KEYS.notificationsEnabled,
      ).enabled,
    };
  }

  /**
   * Berilgan sozlamalarni yangilaydi va o'zgargan har biri uchun audit yozuvi qoldiradi.
   *
   * Faqat **haqiqatan o'zgargan** kalitlar yoziladi: forma barcha maydonlarni yuboradi,
   * ya'ni har saqlashda 7 ta soxta audit yozuvi paydo bo'lishi mumkin edi.
   */
  async update(dto: UpdateSettingsDto): Promise<SettingsView> {
    const before = await this.view();
    const changes: AuditChange[] = [];

    const apply = async <K extends keyof SettingsView>(
      field: K,
      key: string,
      wrap: (value: SettingsView[K]) => Prisma.InputJsonValue,
    ): Promise<void> => {
      const next = dto[field] as SettingsView[K] | undefined;
      if (next === undefined) return;

      const previous = before[field];
      if (JSON.stringify(previous) === JSON.stringify(next)) return;

      await this.set(key, wrap(next));
      changes.push({ field, old: previous, new: next });
    };

    await apply('currencyBase', SETTING_KEYS.currencyBase, (mode) => ({
      mode,
    }));
    await apply(
      'reportPeriodStartDay',
      SETTING_KEYS.reportPeriodStartDay,
      (day) => ({ day }),
    );
    await apply(
      'approvalReminderHours',
      SETTING_KEYS.approvalReminderHours,
      (hours) => ({ hours }),
    );
    await apply(
      'expenseEditWindowHours',
      SETTING_KEYS.expenseEditWindowHours,
      (hours) => ({ hours }),
    );
    await apply(
      'defaultLanguage',
      SETTING_KEYS.defaultLanguage,
      (language) => ({ language }),
    );
    await apply('workDays', SETTING_KEYS.workDays, (days) => ({ days }));
    await apply(
      'notificationsEnabled',
      SETTING_KEYS.notificationsEnabled,
      (enabled) => ({ enabled }),
    );

    if (dto.defaultLanguage !== undefined) {
      // `companies.defaultLanguage` ustuni sxemada bor va yangi foydalanuvchi
      // yaratishda ishlatiladi — sozlama bilan ikkiga ajralib qolmasligi kerak
      await this.prisma.db.company.updateMany({
        where: { id: this.tenantContext.requireCompanyId('Company', 'write') },
        data: { defaultLanguage: dto.defaultLanguage },
      });
    }

    if (changes.length > 0) {
      await this.audit.log({
        action: 'settings.update',
        entityType: 'Setting',
        changes,
      });
    }

    return this.view();
  }

  /** Testlar va sozlama tashqaridan o'zgartirilgan holatlar uchun */
  clearCache(): void {
    this.cache.clear();
  }
}
