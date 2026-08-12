import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

/**
 * TZ 3.1 / 4.2 — parollar argon2id bilan hash qilinadi, ochiq holda hech qayerda saqlanmaydi.
 */
@Injectable()
export class PasswordService {
  private readonly options = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Xodim yaratilganda ko'rsatiladigan boshlang'ich parol (TZ 3.3).
   * Chalkashtiruvchi belgilar (0/O, 1/l/I) chiqarib tashlangan — qo'lda ko'chirish uchun.
   */
  generateTemporary(length = 12): string {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }
}
