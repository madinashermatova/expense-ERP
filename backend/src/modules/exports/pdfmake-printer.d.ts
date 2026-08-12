/**
 * `@types/pdfmake` faqat brauzer API sini (`createPdf`) tavsiflaydi — server tomondagi
 * `PdfPrinter` uchun tipi yo'q. Shu sababli aynan printer moduli shu yerda e'lon qilinadi;
 * `pdfmake` paketining o'z tiplariga tegilmaydi, ya'ni konflikt chiqmaydi.
 */
declare module 'pdfmake/src/printer' {
  import { TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
  import { Readable } from 'node:stream';

  class PdfPrinter {
    constructor(fonts: TFontDictionary);
    createPdfKitDocument(
      documentDefinitions: TDocumentDefinitions,
      options?: Record<string, unknown>,
    ): Readable & { end(): void };
  }

  export = PdfPrinter;
}
