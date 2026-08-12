import { ExportFormat, ExportType, Role } from '../../generated/prisma/enums';

/**
 * E1–E10 eksport turlari katalogi (TZ 3.13).
 *
 * Ruxsat matritsasi endpointdagi `@Roles` bilan emas, shu jadval bilan majburlanadi:
 * bitta endpoint (`POST /exports`) barcha turlarni qabul qiladi, ya'ni rol tekshiruvi
 * tur bo'yicha bo'lishi kerak (masalan E9 — faqat ADMIN).
 */
export interface ExportDefinition {
  type: ExportType;
  titleUz: string;
  titleRu: string;
  roles: readonly Role[];
  formats: readonly ExportFormat[];
}

const BOTH: readonly ExportFormat[] = [ExportFormat.XLSX, ExportFormat.PDF];
const XLSX_ONLY: readonly ExportFormat[] = [ExportFormat.XLSX];

const ADMIN_ONLY: readonly Role[] = [Role.ADMIN];
const ADMIN_DIRECTOR: readonly Role[] = [Role.ADMIN, Role.DIRECTOR];

export const EXPORT_CATALOG: Record<ExportType, ExportDefinition> = {
  [ExportType.E1]: {
    type: ExportType.E1,
    titleUz: "Xarajatlar ro'yxati",
    titleRu: 'Список расходов',
    roles: ADMIN_DIRECTOR,
    formats: BOTH,
  },
  [ExportType.E2]: {
    type: ExportType.E2,
    titleUz: "Hisobot: filiallar bo'yicha",
    titleRu: 'Отчёт: по филиалам',
    roles: ADMIN_ONLY,
    formats: BOTH,
  },
  [ExportType.E3]: {
    type: ExportType.E3,
    titleUz: "Hisobot: kategoriyalar bo'yicha",
    titleRu: 'Отчёт: по категориям',
    roles: ADMIN_DIRECTOR,
    formats: BOTH,
  },
  [ExportType.E4]: {
    type: ExportType.E4,
    titleUz: "Hisobot: xodimlar bo'yicha",
    titleRu: 'Отчёт: по сотрудникам',
    roles: ADMIN_DIRECTOR,
    formats: BOTH,
  },
  [ExportType.E5]: {
    type: ExportType.E5,
    titleUz: 'Byudjet vs Fakt',
    titleRu: 'Бюджет vs Факт',
    roles: ADMIN_DIRECTOR,
    formats: BOTH,
  },
  [ExportType.E6]: {
    type: ExportType.E6,
    titleUz: "Qaytarishlar ro'yxati",
    titleRu: 'Список возвратов',
    roles: ADMIN_DIRECTOR,
    formats: XLSX_ONLY,
  },
  [ExportType.E7]: {
    type: ExportType.E7,
    titleUz: "Xodimlar ro'yxati",
    titleRu: 'Список сотрудников',
    roles: ADMIN_DIRECTOR,
    formats: XLSX_ONLY,
  },
  [ExportType.E8]: {
    type: ExportType.E8,
    titleUz: "Filiallar ro'yxati",
    titleRu: 'Список филиалов',
    roles: ADMIN_ONLY,
    formats: XLSX_ONLY,
  },
  [ExportType.E9]: {
    type: ExportType.E9,
    titleUz: 'Audit jurnali',
    titleRu: 'Журнал аудита',
    roles: ADMIN_ONLY,
    formats: XLSX_ONLY,
  },
  [ExportType.E10]: {
    type: ExportType.E10,
    titleUz: 'Tasdiqlash tarixi',
    titleRu: 'История согласований',
    roles: ADMIN_ONLY,
    formats: XLSX_ONLY,
  },
};

/**
 * Shu chegaradan katta eksport fon rejimida generatsiya qilinadi (TZ 3.13) —
 * so'rov `jobId` bilan darhol qaytadi.
 */
export const SYNC_ROW_LIMIT = 1000;

/** Bitta eksportdagi eng ko'p qator — fon rejimida ham xotira cheklovi kerak */
export const MAX_EXPORT_ROWS = 100_000;

/** Tayyor fayl storageda shuncha soat turadi, keyin cron o'chiradi (TZ 3.13) */
export const EXPORT_TTL_HOURS = 24;
