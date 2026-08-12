import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppLanguage, isAppLanguage } from '../i18n/languages';
import { Channel } from '../../generated/prisma/enums';
import { TenantContextService } from './tenant-context.service';

/**
 * So'rovda **ataylab ko'rsatilgan** til: `?lang=` yoki `x-lang`.
 *
 * `Accept-Language` bu yerda o'qilmaydi — u brauzerning sukut sozlamasi va
 * foydalanuvchining profildagi tanlovidan ustun turmasligi kerak (TZ 4.3).
 * Kirmagan so'rovlarda uni `nestjs-i18n` resolveri hal qiladi.
 */
function explicitLanguage(req: Request): AppLanguage | null {
  const fromQuery = req.query?.lang;
  const fromHeader = req.headers['x-lang'];
  const value =
    typeof fromQuery === 'string'
      ? fromQuery
      : typeof fromHeader === 'string'
        ? fromHeader
        : null;

  return value && isAppLanguage(value) ? value : null;
}

/**
 * Har bir HTTP so'rov uchun bo'sh tenant konteksti ochadi.
 *
 * `companyId` / `userId` / `role` bu yerda to'ldirilmaydi — ularni `JwtAuthGuard`
 * token tekshirilgandan keyin `patch()` bilan qo'yadi (S2). Shu sababli
 * autentifikatsiyadan o'tmagan so'rov biznes jadvaliga tegsa, extension
 * `TENANT_CONTEXT_MISSING` xatosi beradi — bu to'g'ri xatti-harakat.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('x-request-id', requestId);

    this.tenantContext.run(
      {
        requestId,
        channel: Channel.WEB,
        ip: req.ip ?? null,
        language: explicitLanguage(req),
      },
      () => next(),
    );
  }
}
