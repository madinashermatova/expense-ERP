import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

export interface HttpTestApp {
  app: INestApplication;
  prisma: PrismaService;
  close: () => Promise<void>;
}

/**
 * To'liq HTTP ilova (guardlar, filter, middleware bilan) — supertest uchun.
 *
 * Rate limiting sukut bo'yicha o'chiriladi: aks holda bir IP dan ketma-ket yuborilgan
 * test so'rovlari 429 ga uchraydi va boshqa xatti-harakatni tekshirib bo'lmaydi.
 * Throttler ning o'zi `throttle.int-spec.ts` da alohida tekshiriladi.
 */
export async function createHttpApp(
  options: { throttling?: boolean } = {},
): Promise<HttpTestApp> {
  // `@Throttle` dekoratori endpointda qattiq limit belgilagani uchun guard ni
  // override qilish yetarli emas — ThrottlerModule ning `skipIf` i ishlatiladi.
  process.env.DISABLE_THROTTLE = options.throttling ? 'false' : 'true';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    close: async () => {
      await app.close();
    },
  };
}

export const API = (path: string): string => `/api${path}`;
