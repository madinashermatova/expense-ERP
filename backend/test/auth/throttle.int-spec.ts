import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { API, createHttpApp } from '../helpers/http-app';
import { truncateAll } from '../helpers/test-context';
import { seedCompany } from '../helpers/seed-fixtures';

/**
 * TZ 4.2 — auth endpointlar uchun 5 req/min per IP.
 * Bu yerda throttler ataylab yoqilgan (boshqa test fayllarida o'chirilgan).
 */
describe('Rate limiting (TZ 4.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let close: () => Promise<void>;

  const http = () => request(app.getHttpServer() as App);

  beforeAll(async () => {
    const ctx = await createHttpApp({ throttling: true });
    app = ctx.app;
    prisma = ctx.prisma;
    close = ctx.close;

    await truncateAll(prisma);
    await seedCompany(prisma, 'alfa', 'alfa.uz');
  });

  afterAll(async () => {
    await close();
  });

  it('bir IP dan 5 tadan ortiq login urinishi 429 bilan cheklanadi', async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 7; i += 1) {
      const res = await http()
        .post(API('/auth/login'))
        .send({ login: 'yoq@alfa.uz', password: 'NotoGriParol1' });
      statuses.push(res.status);
    }

    // Dastlabki 5 tasi biznes-logikaga yetib boradi (401), keyingilari throttler bilan to'xtatiladi
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5)).toEqual([429, 429]);
  });
});
