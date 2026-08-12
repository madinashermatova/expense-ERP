import { JobsOptions } from 'bullmq';
import { Language, Role } from '../../generated/prisma/enums';

export const EXPORT_QUEUE = 'exports';
export const EXPORT_JOB = 'generate';

/**
 * Fon rejimidagi eksport jobi (TZ 3.13).
 *
 * Rol va filial job ichida uzatiladi: processor so'rov konteksti tashqarisida ishlaydi,
 * lekin eksport **so'ragan foydalanuvchining** doirasida generatsiya qilinishi shart —
 * aks holda direktor so'ragan faylga boshqa filial qatorlari tushib ketardi.
 */
export interface ExportJobData {
  companyId: string;
  exportJobId: string;
  userId: string;
  role: Role;
  branchId: string | null;
  language: Language;
}

export const EXPORT_JOB_OPTIONS: JobsOptions = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: true,
  removeOnFail: false,
};
