import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { EncryptionService } from '../../src/common/crypto/encryption.service';
import { BotDirectoryService } from '../../src/modules/telegram/bot-directory.service';
import { BotSessionService } from '../../src/modules/telegram/bot-session.service';
import { BUTTONS } from '../../src/modules/telegram/bot-texts';
import { createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import {
  seedCompany,
  SeededCompany,
  TEST_PASSWORD,
} from '../helpers/seed-fixtures';
import { botUser, BotUser } from '../helpers/bot-harness';

const SHARED_BOT = 'shared-bot';

/** TZ 3.12.1, 3.12.2, 3.16.5 — bot kirish oqimi va hisoblar bilan ishlash */
describe('Telegram bot: kirish va hisoblar (TZ 3.12)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let sessions: BotSessionService;
  let alfa: SeededCompany;
  let beta: SeededCompany;
  let user: BotUser;

  const TG = 5_000_001n;

  const login = async (
    person: BotUser,
    loginValue: string,
    password = TEST_PASSWORD,
  ) => {
    await person.send('/start');
    await person.send(BUTTONS.login.uz);
    await person.send(loginValue);
    await person.send(password);
  };

  /**
   * Kirgan foydalanuvchi ustiga ikkinchi hisobni qo'shadi (TZ 3.12.2).
   * Bitta hisobda menyuda "Hisobni almashtirish" yo'q, shuning uchun yo'l sozlamalardan.
   */
  const addAccount = async (
    person: BotUser,
    loginValue: string,
    password = TEST_PASSWORD,
  ) => {
    await person.send(BUTTONS.settings.uz);
    await person.pressByText('Boshqa hisob');
    await person.send(loginValue);
    await person.send(password);
  };

  beforeAll(async () => {
    const ctx = await createHttpApp();
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;
    sessions = app.get(BotSessionService);
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    alfa = await seedCompany(prisma, 'alfa', 'alfa.test');
    beta = await seedCompany(prisma, 'beta', 'beta.test');
    // Redis keshi testlar orasida saqlanib qoladi — truncate qilingan bazadan keyin
    // eski `activeLinkId` bilan boshlanmaslik uchun sessiya ham tozalanadi
    await sessions.forget(SHARED_BOT, TG);
    user = botUser(app, TG, SHARED_BOT);
  });

  it('kirmagan foydalanuvchiga faqat kirish va yordam ko‘rinadi', async () => {
    await user.send('/start');

    // Til tanlash + kirish ekrani
    expect(user.tx.lastKeyboard).toEqual([BUTTONS.login.uz, BUTTONS.help.uz]);

    user.tx.reset();
    await user.send(BUTTONS.addExpense.uz);

    expect(user.tx.last.text).toContain('kirish kerak');
    expect(user.tx.lastKeyboard).toEqual([BUTTONS.login.uz, BUTTONS.help.uz]);
  });

  it('to‘g‘ri login+parol bilan rolga mos menyu ochiladi va parol xabari o‘chiriladi', async () => {
    await login(user, alfa.workerEmail);

    expect(user.tx.allText).toContain('Ishchi');
    expect(user.tx.lastKeyboard).toContain(BUTTONS.addExpense.uz);
    // Ishchida yakuniy tasdiqlash tugmasi bo'lmaydi
    expect(user.tx.lastKeyboard).not.toContain(BUTTONS.finalApprovals.uz);

    // Parol yozilgan xabar darhol o'chiriladi (TZ 3.12.1)
    expect(user.tx.deleted).toContainEqual({
      chatId: Number(TG),
      messageId: user.lastMessageId,
    });
  });

  it('noto‘g‘ri parolda login mavjudligi oshkor qilinmaydi', async () => {
    await login(user, alfa.workerEmail, 'YomonParol1!');
    const wrongPassword = user.tx.allText;

    user.tx.reset();
    const other = botUser(app, 5_000_099n, SHARED_BOT);
    await login(other, 'yoq@alfa.test', 'YomonParol1!');

    expect(wrongPassword).toContain("Login yoki parol noto'g'ri");
    expect(other.tx.allText).toContain("Login yoki parol noto'g'ri");
  });

  it('5 muvaffaqiyatsiz urinishdan keyin bloklanadi', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await user.send(BUTTONS.login.uz);
      await user.send(alfa.workerEmail);
      await user.send('YomonParol1!');
    }

    expect(user.tx.allText).toContain('Juda ko‘p urinish');

    user.tx.reset();
    // Blok davomida to'g'ri parol ham qabul qilinmaydi
    await login(user, alfa.workerEmail);
    expect(user.tx.allText).toContain('Juda ko‘p urinish');

    const attempt = await prisma.raw.telegramLoginAttempt.findUnique({
      where: { telegramId: TG },
    });
    expect(attempt?.failedCount).toBe(5);
    expect(attempt?.lockedUntil).not.toBeNull();
  });

  it('bitta hisobda "Hisobni almashtirish" ko‘rinmaydi, o‘rniga "Chiqish"', async () => {
    await login(user, alfa.workerEmail);

    expect(user.tx.lastKeyboard).toContain(BUTTONS.logout.uz);
    expect(user.tx.lastKeyboard).not.toContain(BUTTONS.switchAccount.uz);
  });

  it('ikki kompaniya hisobi bog‘lanadi, faol hisob ✅ bilan belgilanadi', async () => {
    await login(user, alfa.workerEmail);
    await user.send(BUTTONS.logout.uz);
    // Chiqishdan keyin ikkinchi hisob qo'shiladi — birinchisi qayta bog'lanadi
    await login(user, beta.directorEmail);
    await addAccount(user, alfa.workerEmail);

    user.tx.reset();
    await user.send(BUTTONS.switchAccount.uz);

    const labels = user.tx.lastInline.map((button) => button.text);
    const accounts = labels.filter((label) => label.includes('MChJ'));
    expect(accounts).toHaveLength(2);
    expect(accounts.filter((label) => label.startsWith('✅'))).toHaveLength(1);
    expect(user.tx.lastInline.some((b) => b.data === 'acc:logoutAll')).toBe(
      true,
    );
  });

  it('hisob almashtirilganda parol so‘ralmaydi va kontekst darhol o‘tadi', async () => {
    await login(user, beta.directorEmail);
    await addAccount(user, alfa.workerEmail);

    await user.send(BUTTONS.switchAccount.uz);
    const target = user.inlineData('beta MChJ');
    user.tx.reset();
    await user.press(target);

    expect(user.tx.allText).toContain('beta MChJ');
    // Almashtirishda parol qayta so'ralmaydi (TZ 3.12.2)
    expect(user.tx.allText).not.toContain('Parolni yuboring');
    // Direktor menyusi ochildi — ya'ni yangi hisob konteksti amalda
    expect(user.tx.lastKeyboard).toContain(BUTTONS.pendingApprovals.uz);

    const session = await sessions.load(SHARED_BOT, TG);
    const link = await prisma.raw.telegramAccountLink.findUnique({
      where: { id: session.activeLinkId! },
    });
    expect(link?.companyId).toBe(beta.companyId);
  });

  it('yarim tugallangan oqim paytida hisob almashtirilsa oqim bekor qilinadi', async () => {
    await login(user, beta.directorEmail);
    await addAccount(user, alfa.workerEmail);

    // Yangi hisob qo'shish oqimini boshlab, uni tugatmaymiz
    await user.send(BUTTONS.switchAccount.uz);
    await user.pressByText('Boshqa hisob');

    let session = await sessions.load(SHARED_BOT, TG);
    expect(session.flow).not.toBeNull();

    user.tx.reset();
    await user.send(BUTTONS.switchAccount.uz);
    await user.pressByText('beta MChJ');

    expect(user.tx.allText).toContain('bekor qilindi');
    session = await sessions.load(SHARED_BOT, TG);
    expect(session.flow).toBeNull();
  });

  it('chiqishdan keyin menyu ishlamaydi va qayta login so‘raladi', async () => {
    await login(user, alfa.workerEmail);
    await user.send(BUTTONS.logout.uz);

    user.tx.reset();
    await user.send(BUTTONS.addExpense.uz);

    expect(user.tx.last.text).toContain('kirish kerak');
    expect(user.tx.lastKeyboard).toEqual([BUTTONS.login.uz, BUTTONS.help.uz]);
  });

  it('barcha hisoblardan chiqish barcha bog‘lanishni bekor qiladi', async () => {
    await login(user, beta.directorEmail);
    await addAccount(user, alfa.workerEmail);

    await user.send(BUTTONS.switchAccount.uz);
    await user.pressByText('Barcha hisoblardan');

    const links = await prisma.raw.telegramAccountLink.findMany({
      where: { telegramId: TG },
    });
    expect(links.every((link) => link.isRevoked)).toBe(true);

    user.tx.reset();
    await user.send(BUTTONS.myExpenses.uz);
    expect(user.tx.last.text).toContain('kirish kerak');
  });

  it('30 kundan keyin sessiya muddati tugaydi va qayta kirish so‘raladi', async () => {
    await login(user, alfa.workerEmail);
    const session = await sessions.load(SHARED_BOT, TG);

    await prisma.raw.telegramAccountLink.update({
      where: { id: session.activeLinkId! },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    user.tx.reset();
    await user.send(BUTTONS.myExpenses.uz);

    expect(user.tx.allText).toContain('Sessiya muddati tugadi');
    expect(user.tx.lastKeyboard).toEqual([BUTTONS.login.uz, BUTTONS.help.uz]);
  });

  it('til ruschaga o‘tkazilganda tugmalar va xabarlar rus tilida chiqadi', async () => {
    await login(user, alfa.workerEmail);

    user.tx.reset();
    await user.press('lang:ru');

    expect(user.tx.last.text).toBe('Язык изменён.');
    expect(user.tx.lastKeyboard).toContain(BUTTONS.addExpense.ru);

    // Foydalanuvchi eski (o'zbekcha) klaviaturani bosib qolsa ham tugma ishlaydi
    user.tx.reset();
    await user.send(BUTTONS.settings.uz);
    expect(user.tx.last.text).toContain('Настройки');
  });

  it('oqim Redis o‘chirilgan holatda ham DB dan davom etadi', async () => {
    await user.send(BUTTONS.login.uz);
    await user.send(alfa.workerEmail);

    // Bot qayta ishga tushdi: keshdagi holat yo'q, DB dagi `flowState` qoladi
    const row = await prisma.raw.telegramSession.findUnique({
      where: { telegramId_botId: { telegramId: TG, botId: SHARED_BOT } },
    });
    expect(row?.flowState).toMatchObject({ name: 'login', step: 'password' });
  });
});

/** TZ 3.16.5 — kompaniya boti faqat o'z kompaniyasiga xizmat qiladi */
describe('Telegram bot: kompaniya boti (TZ 3.16.5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let directory: BotDirectoryService;
  let encryption: EncryptionService;
  let alfa: SeededCompany;
  let beta: SeededCompany;

  const COMPANY_BOT_TOKEN = '777000:AA-company-bot-token';
  const COMPANY_BOT_ID = '777000';

  beforeAll(async () => {
    const ctx = await createHttpApp();
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;
    directory = app.get(BotDirectoryService);
    encryption = app.get(EncryptionService);
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    alfa = await seedCompany(prisma, 'alfa', 'alfa.test');
    beta = await seedCompany(prisma, 'beta', 'beta.test');

    await prisma.raw.company.update({
      where: { id: alfa.companyId },
      data: { telegramBotToken: encryption.encrypt(COMPANY_BOT_TOKEN) },
    });

    await directory.load();
  });

  it('token → companyId xaritasi shifrlangan tokendan quriladi', () => {
    expect(directory.restrictCompanyId(COMPANY_BOT_ID)).toBe(alfa.companyId);
    // Umumiy bot uchun cheklov yo'q
    expect(directory.restrictCompanyId('shared-bot')).toBeNull();
  });

  it('kompaniya botida boshqa kompaniya logini bilan kirish rad etiladi', async () => {
    const user = botUser(app, 5_000_777n, COMPANY_BOT_ID);

    await user.send(BUTTONS.login.uz);
    await user.send(beta.directorEmail);
    await user.send(TEST_PASSWORD);

    expect(user.tx.allText).toContain('faqat alfa MChJ xodimlari uchun');

    const links = await prisma.raw.telegramAccountLink.findMany({
      where: { telegramId: 5_000_777n },
    });
    expect(links).toHaveLength(0);
  });

  it('kompaniya botida o‘z kompaniyasi hisobi bilan kirish o‘tadi', async () => {
    const user = botUser(app, 5_000_778n, COMPANY_BOT_ID);

    await user.send(BUTTONS.login.uz);
    await user.send(alfa.directorEmail);
    await user.send(TEST_PASSWORD);

    expect(user.tx.lastKeyboard).toContain(BUTTONS.pendingApprovals.uz);

    const links = await prisma.raw.telegramAccountLink.findMany({
      where: { telegramId: 5_000_778n, isRevoked: false },
    });
    expect(links).toHaveLength(1);
    expect(links[0].botId).toBe(COMPANY_BOT_ID);
  });
});
