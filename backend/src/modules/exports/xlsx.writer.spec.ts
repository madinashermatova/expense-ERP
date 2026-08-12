import ExcelJS from 'exceljs';
import { Language } from '../../generated/prisma/enums';
import { ExportDataset, ExportMeta } from './export-dataset';
import { XlsxWriter } from './xlsx.writer';

const dataset: ExportDataset = {
  columns: [
    { key: 'name', headerUz: 'Nomi', headerRu: 'Название', type: 'text' },
    { key: 'date', headerUz: 'Sana', headerRu: 'Дата', type: 'date' },
    {
      key: 'amountUzs',
      headerUz: 'Summa (UZS)',
      headerRu: 'Сумма (UZS)',
      type: 'money',
      total: true,
    },
  ],
  rows: [
    { name: 'Birinchi', date: new Date('2026-08-01'), amountUzs: 120000.5 },
    { name: 'Ikkinchi', date: new Date('2026-08-02'), amountUzs: 79999.5 },
  ],
};

const meta: ExportMeta = {
  title: "Xarajatlar ro'yxati",
  period: 'Davr: 2026-08-01 — 2026-08-31',
  filters: ['Filial: Birinchi filial'],
  generatedAt: '12.08.2026 10:00',
  requestedBy: 'Admin Bir',
  language: Language.UZ,
};

/** Faylni qayta o'qib tekshiramiz — yozuvchi API si emas, natija muhim */
async function readBack(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.worksheets[0];
}

describe('XlsxWriter (TZ 3.13)', () => {
  const writer = new XlsxWriter();

  it("summa katakchasi raqam bo'lib yoziladi (matn emas)", async () => {
    const sheet = await readBack(await writer.write(dataset, meta));
    const headerRow = findHeaderRow(sheet);

    const cell = sheet.getRow(headerRow + 1).getCell(3);
    expect(typeof cell.value).toBe('number');
    expect(cell.value).toBe(120000.5);
    expect(cell.numFmt).toBe('#,##0.00');
  });

  it('sana katakchasi sana formatida', async () => {
    const sheet = await readBack(await writer.write(dataset, meta));
    const headerRow = findHeaderRow(sheet);

    const cell = sheet.getRow(headerRow + 1).getCell(2);
    expect(cell.value).toBeInstanceOf(Date);
  });

  it("oxirgi qatorda jami bo'ladi", async () => {
    const sheet = await readBack(await writer.write(dataset, meta));
    const headerRow = findHeaderRow(sheet);
    const totalRow = sheet.getRow(headerRow + dataset.rows.length + 1);

    expect(totalRow.getCell(1).value).toBe('Jami');
    expect(totalRow.getCell(3).value).toBe(200000);
  });

  it('sarlavha qatori muzlatiladi va avtofiltr yoqiladi', async () => {
    const sheet = await readBack(await writer.write(dataset, meta));
    const headerRow = findHeaderRow(sheet);

    expect(sheet.views[0]).toMatchObject({
      state: 'frozen',
      ySplit: headerRow,
    });
    expect(sheet.autoFilter).toBeTruthy();
  });

  it("sarlavha bloki hisobot nomi, davr, filtr va foydalanuvchini ko'rsatadi", async () => {
    const sheet = await readBack(await writer.write(dataset, meta));

    expect(sheet.getRow(1).getCell(1).value).toBe(meta.title);
    expect(sheet.getRow(2).getCell(1).value).toBe(meta.period);
    expect(sheet.getRow(3).getCell(1).value).toContain('Birinchi filial');
    expect(sheet.getRow(4).getCell(1).text).toContain('Admin Bir');
  });

  it('ruscha tilda ustun sarlavhalari va jami tarjima qilinadi', async () => {
    const sheet = await readBack(
      await writer.write(dataset, { ...meta, language: Language.RU }),
    );
    const headerRow = findHeaderRow(sheet);

    expect(sheet.getRow(headerRow).getCell(3).value).toBe('Сумма (UZS)');
    expect(
      sheet.getRow(headerRow + dataset.rows.length + 1).getCell(1).value,
    ).toBe('Итого');
  });
});

/** Sarlavha bloki uzunligi o'zgarsa test sinmasin — ustun qatorini topib olamiz */
function findHeaderRow(sheet: ExcelJS.Worksheet): number {
  for (let index = 1; index <= sheet.rowCount; index += 1) {
    if (sheet.getRow(index).getCell(1).value === 'Nomi') return index;
    if (sheet.getRow(index).getCell(1).value === 'Название') return index;
  }
  throw new Error('Ustun sarlavhalari qatori topilmadi');
}
