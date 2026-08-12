import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { BotSessionService } from '../../src/modules/telegram/bot-session.service';
import { BUTTONS } from '../../src/modules/telegram/bot-texts';
import {
  EditRequestStatus,
  ExpenseStatus,
  RefundStatus,
} from '../../src/generated/prisma/enums';
import { createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import {
  seedCompany,
  SeededCompany,
  TEST_PASSWORD,
} from '../helpers/seed-fixtures';
import { botUser, BotUser } from '../helpers/bot-harness';

const BOT = 'approve-bot';
const WORKER_TG = 7_000_001n;
const DIRECTOR_TG = 7_000_002n;
const ADMIN_TG = 7_000_003n;

const REASON = 'Chek noaniq, qaytadan yuboring';

/** TZ 3.12.3 — tasdiqlash kartochkalari, qaytarish va tahrirlash sahnalari */
describe('Telegram bot: tasdiqlash va so‘rovlar (TZ 3.12.3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let sessions: BotSessionService;
  let alfa: SeededCompany;
  let worker: BotUser;
  let director: BotUser;
  let admin: BotUser;

  const login = async (person: BotUser, loginValue: string) => {
    await person.send(BUTTONS.login.uz);
    await person.send(loginValue);
    await person.send(TEST_PASSWORD);
    person.tx.reset();
  };

  /** Ishchi nomidan bot orqali xarajat kiritadi */
  const createExpense = async (amount = '150000') => {
    await worker.send(BUTTONS.addExpense.uz);
    await worker.pressByText('Taksi');
    await worker.pressByText("O'zim uchun");
    await worker.send(amount);
    await worker.pressByText('Bugun');
    await worker.pressByText('tkazib yuborish');
    await worker.pressByText('tkazib yuborish');
    await worker.pressByText('Yuborish');
    worker.tx.reset();
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
    await prisma.raw.category.create({
      data: {
        companyId: alfa.companyId,
        nameUz: 'Taksi',
        nameRu: 'Такси',
        sortOrder: 1,
      },
    });

    for (const telegramId of [WORKER_TG, DIRECTOR_TG, ADMIN_TG]) {
      await sessions.forget(BOT, telegramId);
    }

    worker = botUser(app, WORKER_TG, BOT);
    director = botUser(app, DIRECTOR_TG, BOT);
    admin = botUser(app, ADMIN_TG, BOT);

    await login(worker, alfa.workerEmail);
    await login(director, alfa.directorEmail);
    await login(admin, alfa.adminEmail);
  });

  it('direktor kartochkani ko‘radi va tasdiqlaydi', async () => {
    await createExpense();

    await director.send(BUTTONS.pendingApprovals.uz);
    expect(director.tx.last.text).toContain('EXP-000001');
    expect(director.tx.last.text).toContain('150 000');
    expect(director.tx.last.text).toContain('Ishchi');

    const approve = director.inlineData('Tasdiqlash');
    director.tx.reset();
    await director.press(approve);

    expect(director.tx.allText).toContain('tasdiqlandi');

    const expense = await prisma.raw.expense.findFirstOrThrow();
    expect(expense.status).toBe(ExpenseStatus.ADMIN_PENDING);
  });

  it('ikkinchi bosishda "allaqachon qayta ishlangan" chiqadi (idempotentlik)', async () => {
    await createExpense();

    await director.send(BUTTONS.pendingApprovals.uz);
    const approve = director.inlineData('Tasdiqlash');
    await director.press(approve);

    director.tx.reset();
    await director.press(approve);

    // Status allaqachon o'zgargan — o'tish endi mumkin emas
    expect(director.tx.allText).toContain('allaqachon qayta ishlangan');

    const history = await prisma.raw.expenseStatusHistory.findMany();
    // Yaratilish + bitta qaror: ikkinchi bosish tarixga yozilmaydi
    expect(history).toHaveLength(2);
  });

  it('rad etishda sabab majburiy va qisqa sabab qabul qilinmaydi', async () => {
    await createExpense();

    await director.send(BUTTONS.pendingApprovals.uz);
    await director.pressByText('Rad etish');
    expect(director.tx.last.text).toContain('Sababni yozing');

    await director.send('qisqa');
    expect(director.tx.last.text).toContain('kamida');

    const expense = await prisma.raw.expense.findFirstOrThrow();
    expect(expense.status).toBe(ExpenseStatus.DIRECTOR_PENDING);

    await director.send(REASON);
    expect(director.tx.allText).toContain('rad etildi');

    const rejected = await prisma.raw.expense.findFirstOrThrow();
    expect(rejected.status).toBe(ExpenseStatus.REJECTED);
    const history = await prisma.raw.expenseStatusHistory.findMany({
      orderBy: { createdAt: 'asc' },
    });
    expect(history[1].reason).toBe(REASON);
    expect(history[1].channel).toBe('TELEGRAM');
  });

  it('tuzatish so‘ralganda xarajat NEEDS_FIX bo‘ladi', async () => {
    await createExpense();

    await director.send(BUTTONS.pendingApprovals.uz);
    await director.pressByText('Tuzatish');
    await director.send(REASON);

    expect(director.tx.allText).toContain('tuzatish so‘raldi');
    const expense = await prisma.raw.expense.findFirstOrThrow();
    expect(expense.status).toBe(ExpenseStatus.NEEDS_FIX);
  });

  it('ketma-ket kartochkalarni ⬅️ ➡️ bilan ko‘rish mumkin', async () => {
    await createExpense('100000');
    await createExpense('200000');

    await director.send(BUTTONS.pendingApprovals.uz);
    expect(director.tx.last.text).toContain('(1/2)');

    await director.pressByText('➡️');
    expect(director.tx.last.text).toContain('(2/2)');
    expect(director.tx.last.text).toContain('200 000');

    await director.pressByText('⬅️');
    expect(director.tx.last.text).toContain('(1/2)');
  });

  it('bosh admin yakuniy tasdiqni beradi', async () => {
    await createExpense();

    await director.send(BUTTONS.pendingApprovals.uz);
    await director.press(director.inlineData('Tasdiqlash'));

    await admin.send(BUTTONS.finalApprovals.uz);
    expect(admin.tx.last.text).toContain('EXP-000001');

    const approve = admin.inlineData('Tasdiqlash');
    admin.tx.reset();
    await admin.press(approve);

    expect(admin.tx.allText).toContain('tasdiqlandi');
    const expense = await prisma.raw.expense.findFirstOrThrow();
    expect(expense.status).toBe(ExpenseStatus.APPROVED);
  });

  it('ishchi qaytarish so‘rovini isbot bilan yuboradi, direktor tasdiqlaydi', async () => {
    await createExpense();
    await director.send(BUTTONS.pendingApprovals.uz);
    await director.press(director.inlineData('Tasdiqlash'));
    await admin.send(BUTTONS.finalApprovals.uz);
    await admin.press(admin.inlineData('Tasdiqlash'));

    worker.tx.reset();
    await worker.send(BUTTONS.refund.uz);
    expect(worker.tx.last.text).toContain('pul qaytarilyapti');

    await worker.pressByText('EXP-000001');
    expect(worker.tx.last.text).toContain('eng ko‘pi');

    await worker.send('500000');
    expect(worker.tx.last.text).toContain('oshmasligi kerak');

    await worker.send('50000');
    expect(worker.tx.last.text).toContain('sababini yozing');

    await worker.send('Xizmat ko‘rsatilmadi, pul qaytarildi');
    expect(worker.tx.last.text).toContain('Isbotni yuboring');

    await worker.sendPhoto('refund-proof');
    expect(worker.tx.last.text).toContain('Tekshirib chiqing');

    const send = worker.inlineData('Yuborish');
    worker.tx.reset();
    await worker.press(send);

    expect(worker.tx.allText).toContain('so‘rovi yuborildi');
    const refund = await prisma.raw.refund.findFirstOrThrow({
      include: { files: true },
    });
    expect(refund.status).toBe(RefundStatus.DIRECTOR_PENDING);
    expect(refund.amount.toString()).toBe('50000');
    expect(refund.files).toHaveLength(1);

    director.tx.reset();
    await director.send(BUTTONS.refundRequests.uz);
    expect(director.tx.last.text).toContain('Qaytarish EXP-000001');

    await director.pressByText('Tasdiqlash');
    const afterDirector = await prisma.raw.refund.findFirstOrThrow();
    expect(afterDirector.status).toBe(RefundStatus.ADMIN_PENDING);
  });

  it('ishchi tahrirlash murojaatini yuboradi, direktor rad etadi', async () => {
    await createExpense();

    worker.tx.reset();
    await worker.send(BUTTONS.editRequest.uz);
    expect(worker.tx.last.text).toContain('tahrirlash kerak');

    await worker.pressByText('EXP-000001');
    await worker.send('qisqa');
    expect(worker.tx.last.text).toContain('kamida');

    await worker.send('Summani 160000 ga tuzatish kerak');
    expect(worker.tx.allText).toContain('Murojaat yuborildi');

    const request = await prisma.raw.editRequest.findFirstOrThrow();
    expect(request.status).toBe(EditRequestStatus.PENDING);

    director.tx.reset();
    await director.send(BUTTONS.editRequests.uz);
    expect(director.tx.last.text).toContain('Murojaat EXP-000001');

    await director.pressByText('Rad etish');
    await director.send(REASON);

    expect(director.tx.allText).toContain('rad etildi');
    const resolved = await prisma.raw.editRequest.findFirstOrThrow();
    expect(resolved.status).toBe(EditRequestStatus.REJECTED);
    expect(resolved.rejectReason).toBe(REASON);
  });

  it('ishchi tasdiqlash kartochkalarini ko‘ra olmaydi', async () => {
    await createExpense();

    worker.tx.reset();
    await worker.send(BUTTONS.pendingApprovals.uz);

    // Ishchi menyusida bu tugma yo'q; bosilsa ham ariza ro'yxati ochilmaydi
    expect(worker.tx.allText).not.toContain('Tasdiqlash');
    expect(worker.tx.lastKeyboard).not.toContain(BUTTONS.pendingApprovals.uz);
  });
});
