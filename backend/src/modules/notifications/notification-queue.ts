import { JobsOptions } from 'bullmq';

export const NOTIFICATION_QUEUE = 'notifications';
export const NOTIFICATION_JOB = 'deliver';

/**
 * Navbatga tushadigan job.
 *
 * `companyId` **majburiy**: processor so'rov konteksti tashqarisida ishlaydi, ya'ni
 * tenant kontekstini job dan tiklaydi. Uni ixtiyoriy qilib qo'ysak, Prisma extension
 * kontekstsiz so'rovda `TenantContextMissingError` bergan bo'lardi — ya'ni xato
 * ishlab chiqarishda emas, testda ushlanadi (TZ 3.16.1).
 */
export interface NotificationJob {
  companyId: string;
  notificationId: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * TZ 3.11 — yuborilmagan bildirishnoma 3 marta qayta uriniladi (eksponensial backoff).
 *
 * Muvaffaqiyatli joblar saqlanmaydi (`removeOnComplete`), yiqilganlar esa qoladi —
 * ular bo'yicha tekshirish va qo'lda qayta yuborish kerak bo'ladi.
 */
export const NOTIFICATION_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true,
  removeOnFail: false,
};
