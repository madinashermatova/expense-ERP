import { execSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';

/**
 * Integratsion testlar mock DB ishlatmaydi (TZ 6) — docker-compose dagi alohida
 * `postgres-test` konteyneriga (5443) ulanadi va migratsiyalarni qo'llaydi.
 */
export default function globalSetup(): void {
  loadEnv();

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      'TEST_DATABASE_URL topilmadi. `.env` ni tekshiring va `docker compose up -d postgres-test` ni ishga tushiring.',
    );
  }

  // Testlar davomida barcha kod aynan shu bazaga yozadi
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = 'test';

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}
