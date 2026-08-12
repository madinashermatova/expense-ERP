import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PREFIX = 'v1';

/**
 * Qaytariladigan maxfiy qiymatlar uchun shifrlash (TZ 4.2, 3.16.5).
 *
 * Parollardan farqli — bu qiymatlar ochiq holda kerak bo'ladi (masalan kompaniya
 * bot tokeni bilan Telegram API ga ulanish), ya'ni hash yaramaydi.
 *
 * Format: `v1:{iv-base64}:{tag-base64}:{ciphertext-base64}`. Versiya prefiksi
 * kalit yoki algoritm kelajakda o'zgarsa eski yozuvlarni ajratish uchun.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const hexKey: string = config.get('ENCRYPTION_KEY', { infer: true });
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      PREFIX,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== PREFIX) {
      throw new Error("Shifrlangan qiymat formati noto'g'ri");
    }

    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ciphertext = Buffer.from(parts[3], 'base64');

    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
      throw new Error("Shifrlangan qiymat buzilgan (iv/tag o'lchami)");
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  }

  /**
   * Qiymat shu servis tomonidan shifrlanganmi. Sozlamalarga token qo'lda
   * kiritilishi mumkin — o'sha holda uni shifrlash kerak, qayta shifrlash emas.
   */
  isEncrypted(value: string): boolean {
    return value.startsWith(`${PREFIX}:`) && value.split(':').length === 4;
  }

  /** Bir xilligini vaqt bo'yicha sizdirmasdan tekshirish (token solishtirish) */
  matches(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
