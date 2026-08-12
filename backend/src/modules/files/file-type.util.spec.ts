import { detectMime, extensionFor, sanitizeFileName } from './file-type.util';

/** Har bir format uchun haqiqiy imzo bilan boshlanadigan minimal bufer */
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from('VP8 '),
]);
const pdf = Buffer.from('%PDF-1.7\n%âãÏÓ', 'binary');

describe('Fayl turini aniqlash (TZ 4.2)', () => {
  it('jpeg imzosini taniydi', () => {
    expect(detectMime(jpeg)).toBe('image/jpeg');
  });

  it('png imzosini taniydi', () => {
    expect(detectMime(png)).toBe('image/png');
  });

  it('webp imzosini taniydi (RIFF....WEBP)', () => {
    expect(detectMime(webp)).toBe('image/webp');
  });

  it('pdf imzosini taniydi', () => {
    expect(detectMime(pdf)).toBe('application/pdf');
  });

  it('ruxsat etilmagan turni rad etadi (gif)', () => {
    const gif = Buffer.from('GIF89a...');
    expect(detectMime(gif)).toBeNull();
  });

  it('bajariladigan faylni rad etadi (ELF)', () => {
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    expect(detectMime(elf)).toBeNull();
  });

  it('Windows exe ni rad etadi (MZ)', () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    expect(detectMime(exe)).toBeNull();
  });

  it("bo'sh va juda qisqa buferni rad etadi", () => {
    expect(detectMime(Buffer.alloc(0))).toBeNull();
    expect(detectMime(Buffer.from([0xff]))).toBeNull();
  });

  it("RIFF bo'lsa ham WEBP bo'lmasa rad etadi (wav)", () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE'),
    ]);
    expect(detectMime(wav)).toBeNull();
  });
});

describe('Kengaytma va fayl nomi', () => {
  it('kengaytma aniqlangan turdan olinadi', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('application/pdf')).toBe('pdf');
  });

  it('fayl nomidan xavfli belgilar olib tashlanadi', () => {
    expect(sanitizeFileName('../../etc/passwd')).not.toContain('/');
    expect(sanitizeFileName('chek 2026.pdf')).toBe('chek_2026.pdf');
  });

  it("bo'sh nom uchun zaxira qiymat qaytadi", () => {
    expect(sanitizeFileName('///')).toBe('fayl');
  });

  it('juda uzun nom qisqartiriladi', () => {
    expect(sanitizeFileName('a'.repeat(300)).length).toBeLessThanOrEqual(120);
  });
});
