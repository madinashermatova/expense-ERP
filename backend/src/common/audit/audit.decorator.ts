import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditOptions {
  /** `branch.create`, `settings.update` — jurnalda ko'rinadigan amal nomi */
  action: string;
  /** `Branch`, `Category` — obyekt turi */
  entityType: string;
  /**
   * Prisma modeli nomi (`branch`, `category`, …). Berilsa, interceptor amaldan
   * **oldin va keyin** yozuvni o'qib `old → new` farqini hisoblaydi. Berilmasa
   * faqat so'rov tanasi yangi qiymat sifatida yoziladi (yaratish va login uchun yetarli).
   */
  model?: string;
  /** Yozuv id si qayerdan olinadi; sukut bo'yicha `:id` yo'l parametri, keyin javobdagi `id` */
  idFrom?: 'param' | 'response';
}

/**
 * Endpointni audit jurnaliga ulaydi (TZ 3.14).
 *
 * Murakkab oqimlar (xarajat, tasdiqlash, qaytarish, byudjet, eksport) `AuditService` ni
 * **o'zi** chaqiradi: u yerda yoziladigan ma'lumot so'rov tanasidan kengroq. Dekorator
 * esa oddiy CRUD uchun — shunda yangi endpoint qo'shilganda audit yozuvini unutish
 * qiyinlashadi.
 */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);
