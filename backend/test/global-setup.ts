import { execSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import Redis from 'ioredis';

/** Testlar navbat uchun alohida Redis bazasini ishlatadi — dev job lariga tegmasligi uchun */
const TEST_REDIS_DB = 1;

/**
 * Integratsion testlar mock DB ishlatmaydi (TZ 6) — docker-compose dagi alohida
 * `postgres-test` konteyneriga (5443) ulanadi va migratsiyalarni qo'llaydi.
 */
export default async function globalSetup(): Promise<void> {
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

  await flushQueueDb();
}

/**
 * Navbat bazasini tozalaydi.
 *
 * Testlarda BullMQ worker o'chirilgan (`DISABLE_QUEUE_WORKER`), ya'ni qo'shilgan
 * job larni hech kim iste'mol qilmaydi va ular run dan run ga to'planib boradi.
 * Yig'ilgan o'n minglab job `queue.obliterate()` ni sekinlashtiradi va qator
 * butunlay osilib qolishiga olib keladi — shuning uchun har run toza boshlanadi.
 */
async function flushQueueDb(): Promise<void> {
  const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    db: TEST_REDIS_DB,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  try {
    await redis.connect();
    await redis.flushdb();
  } catch (error) {
    // Redis ko'tarilmagan bo'lsa testlar baribir ishlaydi (navbat ixtiyoriy kanal)
    console.warn(`Navbat bazasi tozalanmadi: ${String(error)}`);
  } finally {
    redis.disconnect();
  }
}
