import { config as loadEnv } from 'dotenv';

loadEnv();

// globalSetup boshqa jarayonda ishlaydi — har bir test faylida ham qayta qo'yiladi
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.NODE_ENV = 'test';

// Rejalashtiruvchi testlarda o'chiriladi — cron soat boshida ishga tushib
// boshqa test faylining ma'lumotiga tegib ketmasligi kerak (`cron.guard.ts`)
process.env.DISABLE_CRON = 'true';

// BullMQ worker ham o'chiriladi: u Redis ga blokli ulanish ochadi va Jest jarayondan
// chiqa olmay qoladi. Job qo'shish ishlaydi, processor esa aniq chaqirib sinaladi.
process.env.DISABLE_QUEUE_WORKER = 'true';

// Har test fayli o'z Redis DB sini ishlatadi — navbatlar bir-biriga tegmasligi uchun
process.env.REDIS_DB = process.env.REDIS_TEST_DB ?? '1';

// Telegram polling testlarda hech qachon ko'tarilmaydi: router to'g'ridan-to'g'ri
// chaqirib sinaladi, tarmoqqa chiqish esa testni beqaror qilardi (`bot-launcher.service.ts`)
process.env.BOT_ENABLED = 'false';
process.env.DISABLE_BOT_POLLING = 'true';

// Integratsion testlar alohida bucket ishlatadi — dev fayllari bilan aralashmasligi uchun
process.env.S3_BUCKET = 'erp-files-test';
