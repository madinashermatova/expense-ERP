import { Language } from '../../generated/prisma/enums';
import { ExportDataset, ExportMeta } from './export-dataset';
import { PdfWriter } from './pdf.writer';

const dataset: ExportDataset = {
  columns: [
    { key: 'group', headerUz: 'Filial', headerRu: 'Филиал', type: 'text' },
    {
      key: 'totalAmount',
      headerUz: 'Jami (UZS)',
      headerRu: 'Итого (UZS)',
      type: 'money',
      total: true,
    },
  ],
  rows: [
    { group: 'Birinchi filial', totalAmount: 1500000 },
    { group: 'Ikkinchi filial', totalAmount: 500000 },
  ],
};

const meta: ExportMeta = {
  title: "Hisobot: filiallar bo'yicha",
  period: 'Davr: joriy',
  filters: [],
  generatedAt: '12.08.2026 10:00',
  requestedBy: 'Admin Bir',
  language: Language.UZ,
};

describe('PdfWriter (TZ 3.13)', () => {
  const writer = new PdfWriter();

  it('haqiqiy PDF fayl qaytaradi', async () => {
    const buffer = await writer.write(dataset, meta);

    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  /*
   * Kirill matni standart Helvetica bilan chizilmaydi — shu sababli Roboto yuklanadi.
   * Test shriftlar haqiqatan ham vfs dan ochilganini tekshiradi: yuklanmasa
   * pdfkit "font not found" bilan yiqiladi.
   */
  it('ruscha hisobotni ham chizadi', async () => {
    const buffer = await writer.write(dataset, {
      ...meta,
      title: 'Отчёт: по филиалам',
      language: Language.RU,
    });

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
