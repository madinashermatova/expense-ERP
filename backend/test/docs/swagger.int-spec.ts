import { INestApplication } from '@nestjs/common';
import { createHttpApp } from '../helpers/http-app';
import request from 'supertest';
import { App } from 'supertest/types';

interface OpenApiDocument {
  openapi: string;
  info: { title: string; description: string };
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, { properties?: Record<string, unknown> }>;
    securitySchemes: Record<string, unknown>;
  };
}

/**
 * Swagger hujjati (S17.1).
 *
 * Test hujjat **yasalishini** tekshiradi: endpointlar ro'yxati to'liq bo'lishi va
 * DTO sxemalari plugin tomonidan avtomatik chiqarilishi. Bu qo'lda yozilgan
 * `docs/API.md` bilan almashtirilmaydi — u "nima uchun", Swagger esa "aynan qanday".
 */
describe('Swagger hujjati', () => {
  let app: INestApplication;
  let close: () => Promise<void>;
  let doc: OpenApiDocument;

  beforeAll(async () => {
    const ctx = await createHttpApp({ swagger: true });
    app = ctx.app;
    close = ctx.close;

    const res = await request(app.getHttpServer() as App)
      .get('/api/docs-json')
      .expect(200);
    doc = res.body as OpenApiDocument;
  });

  afterAll(async () => {
    await close();
  });

  it('OpenAPI 3 hujjatini beradi', () => {
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toContain('ERP');
  });

  it('barcha asosiy endpointlar hujjatda bor', () => {
    const paths = Object.keys(doc.paths);

    for (const expected of [
      '/api/auth/login',
      '/api/expenses',
      '/api/expenses/{id}',
      '/api/expenses/{id}/approve',
      '/api/expenses/{id}/files',
      '/api/branches',
      '/api/employees',
      '/api/categories',
      '/api/categories/apply-defaults',
      '/api/refunds',
      '/api/edit-requests',
      '/api/budgets',
      '/api/currency/rates',
      '/api/reports/summary',
      '/api/exports',
      '/api/notifications',
      '/api/settings',
      '/api/audit',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('DTO sxemalari plugin tomonidan chiqariladi', () => {
    // So'rov tanasi klass (`*.dto.ts`) bo'lgani uchun maydonlar avtomatik keladi
    const create = doc.components.schemas.CreateExpenseDto;

    expect(create).toBeDefined();
    expect(Object.keys(create.properties ?? {})).toEqual(
      expect.arrayContaining([
        'branchId',
        'categoryId',
        'employeeIds',
        'amount',
        'currency',
        'date',
        'paymentMethod',
      ]),
    );
  });

  it('JWT autentifikatsiyasi va til sarlavhasi hujjatda ko‘rsatilgan', () => {
    expect(doc.components.securitySchemes.bearer).toBeDefined();

    const login = doc.paths['/api/auth/login'].post as {
      parameters?: { name: string }[];
    };
    expect(login.parameters?.map((p) => p.name)).toContain('x-lang');
  });

  it('xato formati tavsifda tushuntirilgan', () => {
    expect(doc.info.description).toContain('statusCode');
    expect(doc.info.description).toContain('code');
    expect(doc.info.description).toContain('x-lang');
  });
});
