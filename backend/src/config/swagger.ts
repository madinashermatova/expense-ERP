import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** `/api/docs` va `/api/docs-json` yo'llari (prefiksdan keyin) */
export const SWAGGER_PATH = 'docs';

/**
 * Interaktiv API hujjati (Swagger UI).
 *
 * So'rov sxemalari **avtomatik**: `@nestjs/swagger` CLI plugini DTO klasslaridan
 * (`*.dto.ts`) maydonlar, tiplar, enum lar va `class-validator` qoidalarini o'zi
 * o'qiydi — shu sababli DTO larga dekorator qo'lda qo'yilmaydi.
 *
 * Javob sxemalari hozircha yo'q: servislar `ExpenseView` kabi **interfeys**
 * qaytaradi, interfeys esa runtime da mavjud emas. Ular klassga o'tkazilgach
 * (`docs/ROADMAP.md` S18) `@ApiOkResponse({ type })` bilan ulanadi. Shu vaqtgacha
 * javob shakllari `docs/API.md` da to'liq yozilgan.
 *
 * Hujjat prodda sukut bo'yicha yopiladi (`SWAGGER_ENABLED`) — endpoint ro'yxati
 * hujum yuzasini kengaytiradi.
 */
export function setupSwagger(app: INestApplication, apiPrefix: string): void {
  const config = new DocumentBuilder()
    .setTitle('Xarajatlar boshqaruvi ERP — API')
    .setDescription(
      [
        '**Autentifikatsiya.** `POST /auth/login` → `accessToken` (15 daqiqa) va',
        '`erp_rt` httpOnly cookie (7 kun). Pastdagi «Authorize» tugmasiga faqat',
        'access tokenni qo\'yish yetarli. Token eskirsa `POST /auth/refresh`.',
        '',
        '**Xato formati** — barcha endpointlarda bir xil:',
        '```json',
        '{ "statusCode": 422, "code": "RECEIPT_REQUIRED",',
        '  "message": "Bu kategoriya uchun chek yoki kvitansiya majburiy",',
        '  "details": { "files": ["Ovqatlanish"] } }',
        '```',
        '`code` — mashina o\'qiydigan barqaror qiymat, mijoz mantiqi shunga tayanadi.',
        '`message` — foydalanuvchi tilidagi matn. `details` bo\'lsa, kalit = forma maydoni.',
        '',
        '**Til.** `x-lang: uz|ru` yoki `?lang=` — so\'rovga tegishli aniq tanlov;',
        'berilmasa foydalanuvchi profilidagi til, keyin `Accept-Language`, keyin `uz`.',
        '',
        '**Ro\'yxatlar** `{ items, total, page, limit, totalPages }` shaklida qaytadi',
        '(istisnolar: `GET /categories` — daraxt, `GET /currency/rates` — massiv).',
        '',
        '**Rollar.** Ishchi (`WORKER`) Web API ga umuman kira olmaydi — u faqat',
        'Telegram bot orqali ishlaydi. Direktor faqat o\'z filiali doirasida ko\'radi.',
        '',
        'Javob shakllari va biznes qoidalari: `docs/API.md`.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'POST /auth/login dan olingan `accessToken`',
    })
    .addGlobalParameters({
      name: 'x-lang',
      in: 'header',
      required: false,
      description: 'Javob matnlari tili',
      schema: { type: 'string', enum: ['uz', 'ru'] },
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(`${apiPrefix}/${SWAGGER_PATH}`, app, document, {
    // Sahifa yangilanganda token yo'qolmasin — qo'lda sinovda ancha qulay
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    customSiteTitle: 'ERP API',
  });
}
