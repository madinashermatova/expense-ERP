import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { TranslationService } from '../../src/common/i18n/translation.service';
import { Language } from '../../src/generated/prisma/enums';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import {
  seedCompany,
  SeededCompany,
  TEST_PASSWORD,
} from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

/** TZ 4.3, 5.4 — yagona xato formati va uz/ru tarjimalar */
describe('i18n va xato formati (TZ 4.3, 5.4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let translations: TranslationService;
  let alfa: SeededCompany;
  let admin: Session;

  const http = () => request(app.getHttpServer() as App);

  beforeAll(async () => {
    const ctx = await createHttpApp();
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;
    translations = app.get(TranslationService);
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    alfa = await seedCompany(prisma, 'alfa', 'alfa.test');
    admin = await loginAs(app, alfa.adminEmail);
  });

  it('xato tanasi { statusCode, code, message } shaklida qaytadi', async () => {
    const res = await http()
      .get(API('/branches/00000000-0000-0000-0000-000000000000'))
      .set(...admin.header)
      .expect(404);

    expect(res.body).toMatchObject({
      statusCode: 404,
      code: 'BRANCH_NOT_FOUND',
      message: 'Filial topilmadi',
    });
    // Xabar kodda emas, tarjimada — javobda faqat tayyor matn bo'ladi
    expect(res.body.message).not.toContain('errors.');
  });

  it('kirgan foydalanuvchi uchun profil tili amal qiladi (Accept-Language ustun emas)', async () => {
    const res = await http()
      .get(API('/branches/00000000-0000-0000-0000-000000000000'))
      .set(...admin.header)
      .set('Accept-Language', 'ru')
      .expect(404);

    // Profilda uz — brauzer sarlavhasi tanlovni bekor qilmaydi (TZ 4.3)
    expect(res.body.code).toBe('BRANCH_NOT_FOUND');
    expect(res.body.message).toBe('Filial topilmadi');
  });

  it('?lang=ru va x-lang sarlavhasi ham qabul qilinadi', async () => {
    const query = await http()
      .get(API('/branches/00000000-0000-0000-0000-000000000000?lang=ru'))
      .set(...admin.header)
      .expect(404);
    const header = await http()
      .get(API('/branches/00000000-0000-0000-0000-000000000000'))
      .set(...admin.header)
      .set('x-lang', 'ru')
      .expect(404);

    expect(query.body.message).toBe('Филиал не найден');
    expect(header.body.message).toBe('Филиал не найден');
  });

  it('profil tili qo‘llanadi, `x-lang` esa uni bekor qiladi', async () => {
    await prisma.raw.user.update({
      where: { id: alfa.adminId },
      data: { language: Language.RU },
    });
    // Til tokenda emas, bazadan o'qiladi — qayta login shart emas
    const res = await http()
      .get(API('/branches/00000000-0000-0000-0000-000000000000'))
      .set(...admin.header)
      .set('Accept-Language', 'uz')
      .expect(404);

    expect(res.body.message).toBe('Филиал не найден');

    // Aniq ko'rsatilgan til profildan ustun
    const override = await http()
      .get(API('/branches/00000000-0000-0000-0000-000000000000'))
      .set(...admin.header)
      .set('x-lang', 'uz')
      .expect(404);
    expect(override.body.message).toBe('Filial topilmadi');
  });

  it('xabar argumentlari qiymat bilan to‘ldiriladi', async () => {
    await http()
      .post(API('/branches'))
      .set(...admin.header)
      .send({ code: 'ZZZ', name: 'Yangi filial' })
      .expect(201);

    const res = await http()
      .post(API('/branches'))
      .set(...admin.header)
      .send({ code: 'ZZZ', name: 'Ikkinchi' })
      .expect(409);

    expect(res.body.code).toBe('BRANCH_CODE_TAKEN');
    expect(res.body.message).toBe('"ZZZ" kodi allaqachon band');
  });

  it('validatsiya xatosi maydon bo‘yicha guruhlanadi va tarjima qilinadi', async () => {
    const res = await http()
      .post(API('/branches'))
      .set(...admin.header)
      .send({ code: '1', name: '' })
      .expect(422);

    expect(res.body).toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_FAILED',
      message: "Kiritilgan ma'lumot noto'g'ri",
    });
    expect(res.body.details.code).toEqual([
      "Filial kodi 2–5 ta lotin harfidan iborat bo'lishi kerak",
    ]);
    // `name` uchun uzunlik qoidasi ishlaydi — xabar qoida nomidan tarjima qilinadi
    expect(res.body.details.name.join(' ')).toContain('Kamida 2 belgi');
  });

  it('validatsiya xatolari ham rus tilida keladi', async () => {
    const res = await http()
      .post(API('/branches'))
      .set(...admin.header)
      .set('x-lang', 'ru')
      .send({ code: '1', name: 'Filial' })
      .expect(422);

    expect(res.body.message).toBe('Введённые данные некорректны');
    expect(res.body.details.code).toEqual([
      'Код филиала должен содержать 2–5 латинских букв',
    ]);
  });

  it('kirmagan so‘rovda ham til sarlavhadan olinadi', async () => {
    const res = await http()
      .post(API('/auth/login'))
      .set('Accept-Language', 'ru')
      .send({ login: alfa.adminEmail, password: 'YomonParol1!' })
      .expect(401);

    expect(res.body.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.message).toBe('Логин или пароль неверны');
  });

  it('noma‘lum kalit uchun kalit nomi emas, umumiy xabar chiqadi', () => {
    expect(translations.translate('errors.BUNDAY_KALIT_YOQ')).toBeNull();
    expect(translations.translateOr('errors.BUNDAY_KALIT_YOQ', 'zaxira')).toBe(
      'zaxira',
    );
  });

  it('barcha xato kodlari ikkala tilda mavjud', () => {
    const uz = translations.translate('errors.NOT_FOUND', { lang: 'uz' });
    const ru = translations.translate('errors.NOT_FOUND', { lang: 'ru' });

    expect(uz).toBe('Yozuv topilmadi');
    expect(ru).toBe('Запись не найдена');
  });

  it('parol xato bo‘lsa login mavjudligi oshkor bo‘lmaydi (tarjimadan keyin ham)', async () => {
    const wrongPassword = await http()
      .post(API('/auth/login'))
      .send({ login: alfa.adminEmail, password: 'YomonParol1!' })
      .expect(401);
    const unknownLogin = await http()
      .post(API('/auth/login'))
      .send({ login: 'yoq@alfa.test', password: TEST_PASSWORD })
      .expect(401);

    expect(wrongPassword.body.message).toBe(unknownLogin.body.message);
  });
});
