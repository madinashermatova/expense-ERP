import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { BotSessionService } from '../../src/modules/telegram/bot-session.service';
import { BUTTONS } from '../../src/modules/telegram/bot-texts';
import { ExpenseStatus } from '../../src/generated/prisma/enums';
import { createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import {
  seedCompany,
  SeededCompany,
  TEST_PASSWORD,
} from '../helpers/seed-fixtures';
import { botUser, BotUser } from '../helpers/bot-harness';

const BOT = 'expense-bot';
const TG = 6_000_001n;

/** TZ 3.12.3 — xarajat qo'shish sahnasi, ro'yxatlar va statistika */
describe('Telegram bot: xarajat oqimi (TZ 3.12.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let sessions: BotSessionService;
  let alfa: SeededCompany;
  let user: BotUser;
  let taxiId: string;

  const login = async (person: BotUser, loginValue: string) => {
    await person.send(BUTTONS.login.uz);
    await person.send(loginValue);
    await person.send(TEST_PASSWORD);
    person.tx.reset();
  };

  /** Kategoriyalar: chek talab qilmaydigan "Taksi" va chek majburiy "Tushlik" */
  const seedCategories = async () => {
    const taxi = await prisma.raw.category.create({
      data: {
        companyId: alfa.companyId,
        nameUz: 'Taksi',
        nameRu: 'Такси',
        sortOrder: 1,
      },
    });
    const lunch = await prisma.raw.category.create({
      data: {
        companyId: alfa.companyId,
        nameUz: 'Tushlik',
        nameRu: 'Обед',
        sortOrder: 2,
        receiptRequired: true,
        commentRequired: true,
      },
    });
    taxiId = taxi.id;
    expect(lunch.receiptRequired).toBe(true);
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
    await seedCategories();
    await sessions.forget(BOT, TG);
    user = botUser(app, TG, BOT);
    await login(user, alfa.workerEmail);
  });

  it('oddiy xarajat: kategoriya → o‘zim → summa → bugun → izohsiz → cheksiz', async () => {
    await user.send(BUTTONS.addExpense.uz);
    expect(user.tx.allText).toContain('Kategoriyani tanlang');

    await user.pressByText('Taksi');
    expect(user.tx.last.text).toContain('kim uchun');

    await user.pressByText("O'zim uchun");
    expect(user.tx.last.text).toContain('Summani yuboring');

    await user.send('150000');
    expect(user.tx.last.text).toContain('Sanani tanlang');

    await user.pressByText('Bugun');
    await user.pressByText('tkazib yuborish');
    await user.pressByText('tkazib yuborish');

    // Tasdiqlash ekrani
    expect(user.tx.last.text).toContain('Tekshirib chiqing');
    expect(user.tx.last.text).toContain('150 000');

    const send = user.inlineData('Yuborish');
    user.tx.reset();
    await user.press(send);

    expect(user.tx.allText).toContain('direktorga yuborildi');

    const expenses = await prisma.raw.expense.findMany({
      include: { shares: true },
    });
    expect(expenses).toHaveLength(1);
    expect(expenses[0].status).toBe(ExpenseStatus.DIRECTOR_PENDING);
    expect(expenses[0].amount.toString()).toBe('150000');
    expect(expenses[0].channel).toBe('TELEGRAM');
    expect(expenses[0].shares).toHaveLength(1);
  });

  it('har qadamda Orqaga oldingi qadamga qaytaradi va ma‘lumot saqlanadi', async () => {
    await user.send(BUTTONS.addExpense.uz);
    await user.pressByText('Taksi');
    await user.pressByText("O'zim uchun");
    await user.send('150000');

    // Sana qadamidan orqaga → summa qadami
    await user.pressByText('Orqaga');
    expect(user.tx.last.text).toContain('Summani yuboring');

    const session = await sessions.load(BOT, TG);
    expect(session.flow).toMatchObject({
      name: 'expense',
      step: 'amount',
      amount: '150000.00',
      categoryId: taxiId,
    });
  });

  it('noto‘g‘ri summa va sana qabul qilinmaydi', async () => {
    await user.send(BUTTONS.addExpense.uz);
    await user.pressByText('Taksi');
    await user.pressByText("O'zim uchun");

    await user.send('-5');
    expect(user.tx.last.text).toContain('Summa noto‘g‘ri');

    await user.send('100 USD');
    expect(user.tx.last.text).toContain('Sanani tanlang');

    await user.send('31.02.2026');
    expect(user.tx.last.text).toContain('Sana noto‘g‘ri');
  });

  it('chek majburiy kategoriyada rasmsiz davom etib bo‘lmaydi', async () => {
    await user.send(BUTTONS.addExpense.uz);
    await user.pressByText('Tushlik');
    await user.pressByText("O'zim uchun");
    await user.send('50000');
    await user.pressByText('Bugun');

    // Izoh majburiy — o'tkazib yuborish tugmasi yo'q
    expect(user.tx.last.text).toContain('izoh majburiy');
    expect(
      user.tx.lastInline.some((button) => button.data === 'exp:skip'),
    ).toBe(false);

    await user.send('Jamoaviy tushlik');
    expect(user.tx.last.text).toContain('chek majburiy');
    expect(
      user.tx.lastInline.some((button) => button.data === 'exp:skip'),
    ).toBe(false);

    // Rasm yuborilgach davom etish paydo bo'ladi
    await user.sendPhoto('photo-file-1');
    expect(user.tx.last.text).toContain('Qabul qilindi');

    await user.pressByText('Davom etish');
    const send = user.inlineData('Yuborish');
    user.tx.reset();
    await user.press(send);

    expect(user.tx.allText).toContain('direktorga yuborildi');
    expect(user.tx.downloaded).toContain('photo-file-1');

    const expense = await prisma.raw.expense.findFirstOrThrow({
      include: { files: true },
    });
    // Chek biriktirilgach DRAFT dan oqimga uzatiladi
    expect(expense.status).toBe(ExpenseStatus.DIRECTOR_PENDING);
    expect(expense.files).toHaveLength(1);
    expect(expense.comment).toBe('Jamoaviy tushlik');
  });

  it('guruh uchun qo‘lda taqsimlash ulushlarni saqlaydi', async () => {
    const employees = await prisma.raw.employee.findMany({
      where: { companyId: alfa.companyId, branchId: alfa.branchIds[0] },
      orderBy: { fullName: 'asc' },
    });

    await user.send(BUTTONS.addExpense.uz);
    await user.pressByText('Taksi');
    await user.pressByText('Guruh');

    await user.press(`exp:emp:${employees[0].id}`);
    await user.press(`exp:emp:${employees[1].id}`);
    await user.pressByText('Davom etish');

    expect(user.tx.last.text).toContain('taqsimlaymiz');
    await user.pressByText('Qo‘lda');

    await user.send('60000');
    await user.send('40000');

    expect(user.tx.last.text).toContain('Sanani tanlang');
    await user.pressByText('Bugun');
    await user.pressByText('tkazib yuborish');
    await user.pressByText('tkazib yuborish');

    expect(user.tx.last.text).toContain('100 000');
    await user.pressByText('Yuborish');

    const expense = await prisma.raw.expense.findFirstOrThrow({
      include: { shares: { orderBy: { amount: 'desc' } } },
    });
    expect(expense.amount.toString()).toBe('100000');
    expect(expense.shares.map((share) => share.amount.toString())).toEqual([
      '60000',
      '40000',
    ]);
  });

  it('oqim o‘rtasida menyu tugmasi bosilsa oqim bekor qilinadi', async () => {
    await user.send(BUTTONS.addExpense.uz);
    await user.pressByText('Taksi');

    user.tx.reset();
    await user.send(BUTTONS.myExpenses.uz);

    expect(user.tx.allText).toContain('Bekor qilindi');
    const session = await sessions.load(BOT, TG);
    expect(session.flow).toBeNull();
  });

  it('"Mening xarajatlarim" faqat o‘z yozuvlarini ko‘rsatadi', async () => {
    await user.send(BUTTONS.addExpense.uz);
    await user.pressByText('Taksi');
    await user.pressByText("O'zim uchun");
    await user.send('150000');
    await user.pressByText('Bugun');
    await user.pressByText('tkazib yuborish');
    await user.pressByText('tkazib yuborish');
    await user.pressByText('Yuborish');

    // Boshqa xodim nomidan yozuv — ro'yxatda ko'rinmasligi kerak
    const other = await prisma.raw.employee.findFirstOrThrow({
      where: { fullName: 'Direktor' },
    });
    const director = botUser(app, 6_000_002n, BOT);
    await sessions.forget(BOT, 6_000_002n);
    await login(director, alfa.directorEmail);
    await director.send(BUTTONS.addExpense.uz);
    await director.pressByText('Taksi');
    await director.pressByText("O'zim uchun");
    await director.send('90000');
    await director.pressByText('Bugun');
    await director.pressByText('tkazib yuborish');
    await director.pressByText('tkazib yuborish');
    await director.pressByText('Yuborish');
    expect(other.id).toBeDefined();

    user.tx.reset();
    await user.send(BUTTONS.myExpenses.uz);

    expect(user.tx.allText).toContain('150 000');
    expect(user.tx.allText).not.toContain('90 000');
  });

  it('statistika o‘z davri va summasini ko‘rsatadi', async () => {
    await user.send(BUTTONS.addExpense.uz);
    await user.pressByText('Taksi');
    await user.pressByText("O'zim uchun");
    await user.send('150000');
    await user.pressByText('Bugun');
    await user.pressByText('tkazib yuborish');
    await user.pressByText('tkazib yuborish');
    await user.pressByText('Yuborish');

    user.tx.reset();
    await user.send(BUTTONS.myStats.uz);

    // Yozuv hali tasdiqlanmagan — sarfda hisoblanmaydi (TZ 3.13)
    expect(user.tx.allText).toContain('Davr:');
    expect(user.tx.allText).toContain('Jami: 0');
    // Ishchiga tasdiqlash hisoblagichlari ko'rsatilmaydi
    expect(user.tx.allText).not.toContain('Kutilmoqda');
  });

  it('bot qayta ishga tushsa oqim DB dagi holatdan davom etadi', async () => {
    await user.send(BUTTONS.addExpense.uz);
    await user.pressByText('Taksi');
    await user.pressByText("O'zim uchun");

    // Redis keshi yo'qoldi — holat DB dagi `flowState` dan tiklanadi
    const row = await prisma.raw.telegramSession.findUniqueOrThrow({
      where: { telegramId_botId: { telegramId: TG, botId: BOT } },
    });
    expect(row.flowState).toMatchObject({ name: 'expense', step: 'amount' });

    user.tx.reset();
    await user.send('150000');
    expect(user.tx.last.text).toContain('Sanani tanlang');
  });
});
