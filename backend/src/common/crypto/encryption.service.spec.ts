import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { EncryptionService } from './encryption.service';

const KEY = 'a'.repeat(64);

function service(key = KEY): EncryptionService {
  const config = {
    get: () => key,
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return new EncryptionService(config);
}

/** TZ 4.2 / 3.16.5 — kompaniya bot tokeni shifrlangan holda saqlanadi */
describe('EncryptionService', () => {
  it('shifrlab, qaytarib ochadi', () => {
    const encryption = service();
    const token = '777000:AA-secret-token';

    const encrypted = encryption.encrypt(token);

    expect(encrypted).not.toContain(token);
    expect(encryption.decrypt(encrypted)).toBe(token);
  });

  it('har chaqiruvda boshqa natija beradi (tasodifiy iv)', () => {
    const encryption = service();

    expect(encryption.encrypt('bir xil')).not.toBe(
      encryption.encrypt('bir xil'),
    );
  });

  it('buzilgan qiymatni ochmaydi (GCM tag tekshiruvi)', () => {
    const encryption = service();
    const encrypted = encryption.encrypt('token');
    const parts = encrypted.split(':');
    // Shifrmatnning oxirgi belgisi almashtiriladi
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('A') ? 'B=' : 'A=');

    expect(() => encryption.decrypt(parts.join(':'))).toThrow();
  });

  it('boshqa kalit bilan ochilmaydi', () => {
    const encrypted = service().encrypt('token');

    expect(() => service('b'.repeat(64)).decrypt(encrypted)).toThrow();
  });

  it('format noto‘g‘ri bo‘lsa aniq xato beradi', () => {
    expect(() => service().decrypt('shifrlanmagan-matn')).toThrow(
      "formati noto'g'ri",
    );
  });

  it('shifrlangan qiymatni shifrlanmagandan ajratadi', () => {
    const encryption = service();

    expect(encryption.isEncrypted(encryption.encrypt('token'))).toBe(true);
    expect(encryption.isEncrypted('777000:AA-plain-token')).toBe(false);
  });
});
