import { Language } from '../../generated/prisma/enums';

/**
 * Ustun tipi yozuvchiga (xlsx/pdf) formatni aytadi.
 *
 * `money` va `number` katakchalari faylga **raqam** bo'lib tushadi (TZ 3.13 qabul
 * mezoni: `typeof === number`), `date` esa sana formatida — matn emas.
 */
export type ExportColumnType =
  'text' | 'number' | 'money' | 'date' | 'datetime';

export interface ExportColumn {
  key: string;
  headerUz: string;
  headerRu: string;
  type: ExportColumnType;
  /** Belgilarda taxminiy kenglik */
  width?: number;
  /** Oxirgi "Jami" qatorida yig'iladimi */
  total?: boolean;
}

export type ExportCell = string | number | Date | null;

export type ExportRow = Record<string, ExportCell>;

export interface ExportDataset {
  columns: ExportColumn[];
  rows: ExportRow[];
}

/** Faylning sarlavha blokidagi ma'lumot (TZ 3.13: nom, davr, filtrlar, kim, qachon) */
export interface ExportMeta {
  title: string;
  period: string | null;
  filters: string[];
  generatedAt: string;
  requestedBy: string;
  language: Language;
}

export function headerOf(column: ExportColumn, language: Language): string {
  return language === Language.RU ? column.headerRu : column.headerUz;
}
