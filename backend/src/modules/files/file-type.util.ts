/**
 * TZ 4.2 — yuklangan fayl turi va MIME tekshiriladi (faqat jpg/png/webp/pdf).
 *
 * Tekshiruv `Content-Type` sarlavhasiga tayanmaydi: uni mijoz o'zi yozadi va soxtalashtirish
 * oson. Buning o'rniga fayl boshidagi imzo (magic bytes) o'qiladi — `.jpg` deb nomlangan
 * bajariladigan fayl shu yerda rad etiladi.
 *
 * Tashqi kutubxona ataylab ishlatilmadi: bizga aynan 4 ta format kerak, ularning
 * imzolari barqaror va bu kod bog'liqliksiz hamda CommonJS bilan muammosiz ishlaydi.
 */

export type AllowedMime =
  'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export const ALLOWED_MIME_TYPES: readonly AllowedMime[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MIME_EXTENSIONS: Record<AllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean => {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buffer[offset + i] === b);
};

/**
 * Fayl mazmunidan haqiqiy MIME turini aniqlaydi.
 * Tanilmasa yoki ruxsat etilmagan tur bo'lsa — `null`.
 */
export function detectMime(buffer: Buffer): AllowedMime | null {
  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return 'image/png';

  // WEBP: "RIFF" .... "WEBP"
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }

  // PDF: "%PDF-"
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return 'application/pdf';

  return null;
}

/** Xavfsiz kengaytma — foydalanuvchi yuborgan nomga emas, aniqlangan turga asoslanadi */
export function extensionFor(mime: AllowedMime): string {
  return MIME_EXTENSIONS[mime];
}

/** Fayl nomini storage kalitiga qo'yish uchun tozalaydi (faqat ko'rsatish uchun saqlanadi) */
export function sanitizeFileName(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w.\- ]+/g, '')
      .trim()
      .slice(0, 120)
      .replace(/\s+/g, '_') || 'fayl'
  );
}
