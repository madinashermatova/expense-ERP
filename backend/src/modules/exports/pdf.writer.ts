import { Injectable, Logger } from '@nestjs/common';
import PdfPrinter from 'pdfmake/src/printer';
import vfsFonts from 'pdfmake/build/vfs_fonts.js';
import type { TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
import {
  ExportColumn,
  ExportDataset,
  ExportMeta,
  headerOf,
} from './export-dataset';

/**
 * pdfmake ning o'zi bilan kelgan Roboto shriftlari base64 ko'rinishida `vfs_fonts`
 * ichida yotadi. Ularni buferga ochib beramiz: standart PDF shriftlari (Helvetica)
 * WinAnsi kodlashda ishlaydi va **kirill harflarini chiza olmaydi** — ruscha hisobot
 * bo'sh kvadratlarga aylanardi.
 */
function loadRobotoFonts(): TFontDictionary {
  const font = (name: string): Buffer =>
    Buffer.from(vfsFonts[name] ?? '', 'base64');

  return {
    Roboto: {
      normal: font('Roboto-Regular.ttf'),
      bold: font('Roboto-Medium.ttf'),
      italics: font('Roboto-Italic.ttf'),
      bolditalics: font('Roboto-MediumItalic.ttf'),
    },
  };
}

const MAX_PDF_COLUMNS = 10;

/**
 * PDF eksporti (TZ 3.13) — E1–E5 uchun.
 *
 * PDF ko'rish uchun mo'ljallangan: ustunlar soni cheklanadi (keng jadval A4 ga
 * sig'maydi), to'liq ma'lumot esa xlsx da qoladi.
 */
@Injectable()
export class PdfWriter {
  private readonly logger = new Logger(PdfWriter.name);
  readonly extension = 'pdf';
  readonly contentType = 'application/pdf';

  private readonly printer = new PdfPrinter(loadRobotoFonts());

  async write(dataset: ExportDataset, meta: ExportMeta): Promise<Buffer> {
    const columns = dataset.columns.slice(0, MAX_PDF_COLUMNS);

    if (dataset.columns.length > MAX_PDF_COLUMNS) {
      this.logger.debug(
        `PDF: ${dataset.columns.length} ustundan ${MAX_PDF_COLUMNS} tasi chiqarildi (${meta.title})`,
      );
    }

    const body: unknown[][] = [
      columns.map((column) => ({
        text: headerOf(column, meta.language),
        bold: true,
        fillColor: '#EFF3F8',
      })),
    ];

    for (const row of dataset.rows) {
      body.push(
        columns.map((column) => ({
          text: renderCell(row[column.key], column),
          alignment: isNumeric(column) ? 'right' : 'left',
        })),
      );
    }

    body.push(this.totalsRow(dataset, columns, meta));

    const definition: TDocumentDefinitions = {
      pageSize: 'A4',
      pageOrientation: columns.length > 5 ? 'landscape' : 'portrait',
      pageMargins: [24, 28, 24, 36],
      defaultStyle: { font: 'Roboto', fontSize: 8 },
      footer: (currentPage: number, pageCount: number) => ({
        text: `${currentPage} / ${pageCount}`,
        alignment: 'center',
        fontSize: 7,
        margin: [0, 10, 0, 0],
      }),
      content: [
        { text: meta.title, fontSize: 14, bold: true, margin: [0, 0, 0, 4] },
        ...(meta.period
          ? [{ text: meta.period, fontSize: 9, margin: [0, 0, 0, 2] }]
          : []),
        ...(meta.filters.length > 0
          ? [
              {
                text: meta.filters.join(' · '),
                fontSize: 8,
                color: '#556070',
                margin: [0, 0, 0, 2],
              },
            ]
          : []),
        {
          text: `${meta.requestedBy} · ${meta.generatedAt}`,
          fontSize: 8,
          color: '#556070',
          margin: [0, 0, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: columns.map(() => '*'),
            body,
          },
          layout: 'lightHorizontalLines',
        },
      ],
    } as TDocumentDefinitions;

    return this.render(definition);
  }

  private totalsRow(
    dataset: ExportDataset,
    columns: ExportColumn[],
    meta: ExportMeta,
  ): unknown[] {
    return columns.map((column, index) => {
      if (index === 0) {
        return { text: meta.language === 'RU' ? 'Итого' : 'Jami', bold: true };
      }
      if (!column.total) return { text: '' };

      const sum = dataset.rows.reduce<number>((acc, row) => {
        const value = row[column.key];
        return typeof value === 'number' ? acc + value : acc;
      }, 0);

      return {
        text: formatNumber(Math.round(sum * 100) / 100, column),
        bold: true,
        alignment: 'right',
      };
    });
  }

  private render(definition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = this.printer.createPdfKitDocument(definition);
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}

function isNumeric(column: ExportColumn): boolean {
  return column.type === 'money' || column.type === 'number';
}

function renderCell(
  value: string | number | Date | null | undefined,
  column: ExportColumn,
): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return column.type === 'datetime'
      ? value.toISOString().slice(0, 16).replace('T', ' ')
      : value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') return formatNumber(value, column);
  return value;
}

function formatNumber(value: number, column: ExportColumn): string {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: column.type === 'money' ? 2 : 0,
    maximumFractionDigits: column.type === 'money' ? 2 : 0,
  });
}
