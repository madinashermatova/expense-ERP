import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  ExportColumn,
  ExportDataset,
  ExportMeta,
  headerOf,
} from './export-dataset';

/** Pul ustuni: mingliklar ajratilgan, 2 kasr — Excel raqam formati (TZ 3.13) */
const MONEY_FORMAT = '#,##0.00';
const NUMBER_FORMAT = '#,##0';
const DATE_FORMAT = 'dd.mm.yyyy';
const DATETIME_FORMAT = 'dd.mm.yyyy hh:mm';

function formatFor(column: ExportColumn): string | undefined {
  switch (column.type) {
    case 'money':
      return MONEY_FORMAT;
    case 'number':
      return NUMBER_FORMAT;
    case 'date':
      return DATE_FORMAT;
    case 'datetime':
      return DATETIME_FORMAT;
    default:
      return undefined;
  }
}

/**
 * Excel eksporti (TZ 3.13).
 *
 * Fayl tuzilishi: sarlavha bloki (hisobot nomi, davr, filtrlar, kim va qachon
 * yaratgani) → ustun sarlavhalari → ma'lumot → **jami** qatori. Sarlavha qatori
 * muzlatiladi va avtofiltr yoqiladi.
 *
 * Summa katakchalari **raqam** bo'lib yoziladi (matn emas) — aks holda Excelda
 * yig'indi va saralash ishlamaydi.
 */
@Injectable()
export class XlsxWriter {
  readonly extension = 'xlsx';
  readonly contentType =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  async write(dataset: ExportDataset, meta: ExportMeta): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(sheetName(meta.title));

    const columnCount = dataset.columns.length;
    const headerRowIndex = this.writeMeta(sheet, meta, columnCount);

    sheet.columns = dataset.columns.map((column) => ({
      key: column.key,
      width: column.width ?? 16,
    }));

    const headerRow = sheet.getRow(headerRowIndex);
    dataset.columns.forEach((column, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = headerOf(column, meta.language);
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFF3F8' },
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFB0BAC6' } } };
    });
    headerRow.commit();

    dataset.rows.forEach((row, rowIndex) => {
      const sheetRow = sheet.getRow(headerRowIndex + 1 + rowIndex);
      dataset.columns.forEach((column, index) => {
        const cell = sheetRow.getCell(index + 1);
        cell.value = row[column.key] ?? null;
        const format = formatFor(column);
        if (format) cell.numFmt = format;
      });
      sheetRow.commit();
    });

    this.writeTotals(sheet, dataset, headerRowIndex, meta);

    // Sarlavha qatorigacha muzlatiladi + avtofiltr (TZ 3.13)
    sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
    sheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex + dataset.rows.length, column: columnCount },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** Sarlavha bloki; qaytadi — ustun sarlavhalari joylashadigan qator raqami */
  private writeMeta(
    sheet: ExcelJS.Worksheet,
    meta: ExportMeta,
    columnCount: number,
  ): number {
    const lines: { text: string; bold?: boolean }[] = [
      { text: meta.title, bold: true },
    ];

    if (meta.period) lines.push({ text: meta.period });
    if (meta.filters.length > 0) {
      lines.push({ text: meta.filters.join(' · ') });
    }
    lines.push({ text: `${meta.requestedBy} · ${meta.generatedAt}` });

    lines.forEach((line, index) => {
      const row = sheet.getRow(index + 1);
      const cell = row.getCell(1);
      cell.value = line.text;
      cell.font = { bold: line.bold ?? false, size: line.bold ? 14 : 10 };
      if (columnCount > 1) {
        sheet.mergeCells(index + 1, 1, index + 1, columnCount);
      }
      row.commit();
    });

    // Sarlavha bloki bilan jadval orasida bo'sh qator
    return lines.length + 2;
  }

  /**
   * Oxirgi qator — jami. Yig'indi `SUM` formulasi bilan emas, hisoblangan qiymat
   * bilan yoziladi: fayl PDF ga aylantirilganda yoki formulani qo'llab-quvvatlamaydigan
   * ko'rgichda ochilganda ham son ko'rinishi kerak.
   */
  private writeTotals(
    sheet: ExcelJS.Worksheet,
    dataset: ExportDataset,
    headerRowIndex: number,
    meta: ExportMeta,
  ): void {
    const totalRowIndex = headerRowIndex + dataset.rows.length + 1;
    const row = sheet.getRow(totalRowIndex);

    dataset.columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      cell.font = { bold: true };
      cell.border = { top: { style: 'thin', color: { argb: 'FFB0BAC6' } } };

      if (index === 0) {
        cell.value = meta.language === 'RU' ? 'Итого' : 'Jami';
        return;
      }

      if (!column.total) return;

      const sum = dataset.rows.reduce<number>((acc, item) => {
        const value = item[column.key];
        return typeof value === 'number' ? acc + value : acc;
      }, 0);

      cell.value = column.type === 'money' ? round2(sum) : sum;
      cell.numFmt = formatFor(column) ?? MONEY_FORMAT;
    });

    row.commit();
  }
}

/** Excel varaq nomida `\ / * ? : [ ]` ishlatib bo'lmaydi, uzunligi ≤ 31 */
function sheetName(title: string): string {
  const cleaned = title.replace(/[\\/*?:[\]]/g, ' ').trim();
  return cleaned.slice(0, 31) || 'Export';
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
