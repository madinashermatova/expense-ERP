import { config as loadEnv } from 'dotenv';

loadEnv();

// globalSetup boshqa jarayonda ishlaydi — har bir test faylida ham qayta qo'yiladi
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.NODE_ENV = 'test';

// Integratsion testlar alohida bucket ishlatadi — dev fayllari bilan aralashmasligi uchun
process.env.S3_BUCKET = 'erp-files-test';
