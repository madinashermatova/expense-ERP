import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { TenantContextService } from '../../src/common/tenancy/tenant-context.service';
import { NOTIFICATION_QUEUE } from '../../src/modules/notifications/notification-queue';
import { NotificationsProcessor } from '../../src/modules/notifications/notifications.processor';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { NotificationTextService } from '../../src/modules/notifications/notification-messages';
import { TelegramSenderService } from '../../src/modules/notifications/telegram-sender.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany, SeededCompany } from '../helpers/seed-fixtures';
import { loginAs, Session } from '../helpers/auth-helper';

describe('Bildirishnomalar (TZ 3.11)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let queue: Queue;
  let notifications: NotificationsService;
  let tenant: TenantContextService;
  let alfa: SeededCompany;
  let admin: Session;
  let admin2: Session;
  let director: Session;
  let categoryId: string;
  let employeeId: string;

  const http = () => request(app.getHttpServer() as App);

  const payload = (over: Record<string, unknown> = {}) => ({
    branchId: alfa.branchIds[0],
    categoryId,
    employeeIds: [employeeId],
    amount: '150000.00',
    currency: 'UZS',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'CASH',
    ...over,
  });

  beforeAll(async () => {
    const ctx = await createHttpApp();
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;
    queue = app.get<Queue>(getQueueToken(NOTIFICATION_QUEUE));
    notifications = app.get(NotificationsService);
    tenant = app.get(TenantContextService);
  });

  afterAll(async () => {
    await queue.obliterate({ force: true }).catch(() => undefined);
    await close();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await queue.obliterate({ force: true });

    alfa = await seedCompany(prisma, 'alfa', 'alfa.uz');
    admin = await loginAs(app, alfa.adminEmail);
    admin2 = await loginAs(app, alfa.admin2Email);
    director = await loginAs(app, alfa.directorEmail);

    const category = await prisma.raw.category.create({
      data: { companyId: alfa.companyId, nameUz: 'Ofis', nameRu: 'Офис' },
    });
    categoryId = category.id;

    const employee = await prisma.raw.employee.findFirstOrThrow({
      where: { companyId: alfa.companyId, branchId: alfa.branchIds[0] },
    });
    employeeId = employee.id;
  });

  // ─── Navbat ────────────────────────────────────────────────────────────────

  it('xarajat yaratilgach direktor uchun navbatga job qo‘shiladi', async () => {
    const before = await queue.getWaitingCount();

    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    expect(await queue.getWaitingCount()).toBe(before + 1);

    const jobs = await queue.getJobs(['waiting']);
    const job = jobs[0];
    expect(job.data.type).toBe('EXPENSE_CREATED');
    // Job payload da companyId majburiy — processor kontekstni shundan tiklaydi
    expect(job.data.companyId).toBe(alfa.companyId);
    expect(job.data.userId).toBe(alfa.directorId);
    expect(job.data.notificationId).toBeDefined();
  });

  it('job 3 marta eksponensial backoff bilan qayta uriniladi', async () => {
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    const [job] = await queue.getJobs(['waiting']);
    expect(job.opts.attempts).toBe(3);
    expect(job.opts.backoff).toEqual({ type: 'exponential', delay: 2000 });
  });

  it('direktor kiritgan ariza bosh adminlarga xabar qiladi', async () => {
    await http()
      .post(API('/expenses'))
      .set(...director.header)
      .send(payload())
      .expect(201);

    const rows = await prisma.raw.notification.findMany({
      where: { companyId: alfa.companyId, type: 'EXPENSE_CREATED' },
    });

    const userIds = rows.map((r) => r.userId).sort();
    expect(userIds).toEqual([alfa.adminId, alfa.admin2Id].sort());
  });

  it('tasdiqlash qarorlari ham navbatga tushadi', async () => {
    const created = await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    await queue.obliterate({ force: true });

    await http()
      .post(API(`/expenses/${created.body.id}/approve`))
      .set(...director.header)
      .send({})
      .expect(201);

    // Ikki bosh adminga — ikki job
    expect(await queue.getWaitingCount()).toBe(2);
  });

  // ─── Web ko'rinishi ────────────────────────────────────────────────────────

  it('o‘qilmagan ro‘yxat va badge soni ishlaydi', async () => {
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    const list = await http()
      .get(API('/notifications'))
      .query({ isRead: 'false' })
      .set(...director.header)
      .expect(200);

    expect(list.body.total).toBe(1);
    expect(list.body.items[0].type).toBe('EXPENSE_CREATED');
    // Matn serverda tayyorlanadi — Web va Telegram bir manbadan
    expect(list.body.items[0].title).toContain('EXP-000001');
    expect(list.body.items[0].title).toContain('150000.00');

    const count = await http()
      .get(API('/notifications/unread-count'))
      .set(...director.header)
      .expect(200);
    expect(count.body.count).toBe(1);
  });

  it('o‘qilgan deb belgilash badge sonini kamaytiradi', async () => {
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    const list = await http()
      .get(API('/notifications'))
      .set(...director.header)
      .expect(200);
    const id = list.body.items[0].id as string;

    await http()
      .post(API(`/notifications/${id}/read`))
      .set(...director.header)
      .expect(204);

    const count = await http()
      .get(API('/notifications/unread-count'))
      .set(...director.header)
      .expect(200);
    expect(count.body.count).toBe(0);
  });

  it('mark-all-read barcha o‘qilmaganlarni yopadi', async () => {
    for (const amount of ['10000.00', '20000.00']) {
      await http()
        .post(API('/expenses'))
        .set(...admin.header)
        .send(payload({ amount }))
        .expect(201);
    }

    const result = await http()
      .post(API('/notifications/mark-all-read'))
      .set(...director.header)
      .expect(201);
    expect(result.body.updated).toBe(2);

    const count = await http()
      .get(API('/notifications/unread-count'))
      .set(...director.header)
      .expect(200);
    expect(count.body.count).toBe(0);
  });

  it('boshqa foydalanuvchining bildirishnomasi ko‘rinmaydi va o‘qilmaydi', async () => {
    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    const directorList = await http()
      .get(API('/notifications'))
      .set(...director.header)
      .expect(200);
    const foreignId = directorList.body.items[0].id as string;

    const adminList = await http()
      .get(API('/notifications'))
      .set(...admin2.header)
      .expect(200);
    expect(adminList.body.total).toBe(0);

    await http()
      .post(API(`/notifications/${foreignId}/read`))
      .set(...admin2.header)
      .expect(404);
  });

  it('matn foydalanuvchi tiliga qarab beriladi', async () => {
    await prisma.raw.user.update({
      where: { id: alfa.directorId },
      data: { language: 'RU' },
    });

    await http()
      .post(API('/expenses'))
      .set(...admin.header)
      .send(payload())
      .expect(201);

    const list = await http()
      .get(API('/notifications'))
      .set(...director.header)
      .expect(200);

    expect(list.body.items[0].title).toContain('Новый расход');
  });

  // ─── Processor ─────────────────────────────────────────────────────────────

  describe('processor', () => {
    let sender: { send: jest.Mock };
    let processor: NotificationsProcessor;

    const makeJob = (data: Record<string, unknown>) =>
      ({ id: 'job-1', data }) as never;

    /** Telegram bog'lanishi bor foydalanuvchi yaratadi */
    const linkTelegram = async (userId: string, telegramId: bigint) => {
      await prisma.raw.telegramAccountLink.create({
        data: {
          telegramId,
          userId,
          companyId: alfa.companyId,
          botId: 'test-bot',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
    };

    const enqueueOne = async (): Promise<{
      notificationId: string;
      userId: string;
    }> => {
      await tenant.runAsync({ companyId: alfa.companyId }, () =>
        notifications.notifyUsers([alfa.directorId], 'EXPENSE_CREATED', {
          globalNumber: 'EXP-000001',
          amount: '150000.00',
        }),
      );

      const row = await prisma.raw.notification.findFirstOrThrow({
        where: { companyId: alfa.companyId, userId: alfa.directorId },
      });
      return { notificationId: row.id, userId: row.userId };
    };

    beforeEach(() => {
      sender = { send: jest.fn() };
      processor = new NotificationsProcessor(
        prisma,
        { ...sender, enabled: true } as unknown as TelegramSenderService,
        tenant,
        app.get(NotificationTextService),
      );
    });

    it('bog‘lanish bo‘lmasa jim o‘tib ketadi', async () => {
      const { notificationId, userId } = await enqueueOne();

      await processor.process(
        makeJob({
          companyId: alfa.companyId,
          notificationId,
          userId,
          type: 'EXPENSE_CREATED',
          payload: {},
        }),
      );

      expect(sender.send).not.toHaveBeenCalled();
    });

    it('yuborilgach sentAt to‘ldiriladi', async () => {
      const { notificationId, userId } = await enqueueOne();
      await linkTelegram(userId, 111n);
      sender.send.mockResolvedValue({ sent: true });

      await processor.process(
        makeJob({
          companyId: alfa.companyId,
          notificationId,
          userId,
          type: 'EXPENSE_CREATED',
          payload: { globalNumber: 'EXP-000001', amount: '150000.00' },
        }),
      );

      expect(sender.send).toHaveBeenCalledTimes(1);
      const text = sender.send.mock.calls[0][1] as string;
      expect(text).toContain('EXP-000001');

      const row = await prisma.raw.notification.findUniqueOrThrow({
        where: { id: notificationId },
      });
      expect(row.sentAt).not.toBeNull();
    });

    it('bot bloklangan bo‘lsa xato bermaydi va xodimga belgi qo‘yiladi', async () => {
      const { notificationId, userId } = await enqueueOne();
      await linkTelegram(userId, 222n);
      sender.send.mockResolvedValue({ sent: false, botBlocked: true });

      await expect(
        processor.process(
          makeJob({
            companyId: alfa.companyId,
            notificationId,
            userId,
            type: 'EXPENSE_CREATED',
            payload: {},
          }),
        ),
      ).resolves.toBeUndefined();

      const director = await prisma.raw.user.findUniqueOrThrow({
        where: { id: userId },
        select: { employeeId: true },
      });
      const employee = await prisma.raw.employee.findUniqueOrThrow({
        where: { id: director.employeeId as string },
      });
      expect(employee.botBlocked).toBe(true);

      const row = await prisma.raw.notification.findUniqueOrThrow({
        where: { id: notificationId },
      });
      expect(row.sentAt).toBeNull();
    });

    it('Telegram xatosi yuqoriga chiqadi — job retry ga tushadi', async () => {
      const { notificationId, userId } = await enqueueOne();
      await linkTelegram(userId, 333n);
      sender.send.mockRejectedValue(new Error('429 Too Many Requests'));

      await expect(
        processor.process(
          makeJob({
            companyId: alfa.companyId,
            notificationId,
            userId,
            type: 'EXPENSE_CREATED',
            payload: {},
          }),
        ),
      ).rejects.toThrow('429');
    });

    it('companyId siz job qayta urinilmaydi', async () => {
      await expect(
        processor.process(
          makeJob({
            companyId: '',
            notificationId: 'x',
            userId: 'y',
            type: 'EXPENSE_CREATED',
            payload: {},
          }),
        ),
      ).resolves.toBeUndefined();

      expect(sender.send).not.toHaveBeenCalled();
    });

    it('bekor qilingan bog‘lanishga yuborilmaydi', async () => {
      const { notificationId, userId } = await enqueueOne();
      await linkTelegram(userId, 444n);
      await prisma.raw.telegramAccountLink.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });

      await processor.process(
        makeJob({
          companyId: alfa.companyId,
          notificationId,
          userId,
          type: 'EXPENSE_CREATED',
          payload: {},
        }),
      );

      expect(sender.send).not.toHaveBeenCalled();
    });
  });
});
