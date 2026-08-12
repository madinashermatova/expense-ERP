import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { API } from './http-app';
import { TEST_PASSWORD } from './seed-fixtures';

export interface Session {
  token: string;
  cookie: string;
  header: [string, string];
}

/** Login qilib, keyingi so'rovlar uchun Authorization sarlavhasini qaytaradi */
export async function loginAs(
  app: INestApplication,
  email: string,
): Promise<Session> {
  const res = await request(app.getHttpServer() as App)
    .post(API('/auth/login'))
    .send({ login: email, password: TEST_PASSWORD })
    .expect(200);

  const token = res.body.accessToken as string;
  const cookie = (res.headers['set-cookie'] as unknown as string[])[0] ?? '';

  return { token, cookie, header: ['Authorization', `Bearer ${token}`] };
}
