import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

/**
 * Fayl yuklash sozlamalari (S6 `POST /expenses/:id/files`, S9 `POST /refunds`).
 *
 * `memoryStorage` ataylab: fayl diskka tushmasdan tekshiriladi va to'g'ridan-to'g'ri
 * S3/MinIO ga yuboriladi. Bu 10 MB × 5 fayl chegarasida xavfsiz va vaqtinchalik
 * fayllarni tozalash muammosini butunlay yo'q qiladi.
 *
 * Bu yerdagi chegaralar — birinchi mudofaa chizig'i (multer darajasi).
 * Haqiqiy tekshiruv `FilesService.validate()` da: magic-byte va MIME mosligi.
 */
export function uploadOptions(
  maxFileSizeMb: number,
  maxFiles: number,
): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: maxFileSizeMb * 1024 * 1024,
      files: maxFiles,
      // Formadagi matn maydonlari uchun oqilona chegara
      fields: 32,
      fieldSize: 1024 * 64,
    },
  };
}
