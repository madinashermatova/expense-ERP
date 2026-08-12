import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, switchMap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_KEY, AuditOptions } from './audit.decorator';
import { AuditService } from './audit.service';

/** Bu maydonlar hech qachon jurnalga tushmaydi (TZ 4.2) */
const REDACTED = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'telegramBotToken',
]);

/** Diff da e'tiborsiz qoldiriladigan texnik maydonlar */
const IGNORED = new Set(['updatedAt', 'createdAt', 'version']);

interface RequestLike {
  params?: Record<string, string>;
  body?: unknown;
}

/**
 * `@Audit()` bilan belgilangan endpointlarni jurnalga yozadi (TZ 3.14).
 *
 * `model` berilgan bo'lsa yozuv **amaldan oldin** o'qiladi va keyingi holat bilan
 * solishtiriladi — shunda `old → new` haqiqiy bo'ladi. Interceptor buni qila oladi,
 * chunki handler dan oldin ham, keyin ham ishlaydi.
 *
 * Audit yozuvi hech qachon asosiy amalni yiqitmaydi: `AuditService.log` xatoni yutadi,
 * bu yerdagi qo'shimcha o'qishlar esa `try/catch` ichida.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<AuditOptions | undefined>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<RequestLike>();
    const paramId = request.params?.id;

    return from(this.snapshot(options, paramId)).pipe(
      switchMap((before) =>
        next
          .handle()
          .pipe(
            switchMap((response: unknown) =>
              from(
                this.write(
                  options,
                  paramId,
                  before,
                  request.body,
                  response,
                ).then(() => response),
              ),
            ),
          ),
      ),
    );
  }

  /** Amaldan oldingi holat — faqat `model` va id ma'lum bo'lganda */
  private async snapshot(
    options: AuditOptions,
    id?: string,
  ): Promise<Record<string, unknown> | null> {
    if (!options.model || !id) return null;

    try {
      return await this.findById(options.model, id);
    } catch (error) {
      this.logger.warn(
        `Audit snapshot olinmadi (${options.model} ${id}): ${String(error)}`,
      );
      return null;
    }
  }

  private async write(
    options: AuditOptions,
    paramId: string | undefined,
    before: Record<string, unknown> | null,
    body: unknown,
    response: unknown,
  ): Promise<void> {
    const entityId = this.resolveId(options, paramId, response);

    let changes = this.fromBody(body);

    if (options.model && entityId) {
      try {
        const after = await this.findById(options.model, entityId);
        if (after) {
          // `before` bo'lmasa (yaratish) — yangi yozuvning o'zi "yangi qiymat"
          changes = this.audit
            .diff(sanitize(before ?? {}), sanitize(after))
            .filter((change) => !IGNORED.has(change.field));
        }
      } catch (error) {
        this.logger.warn(
          `Audit diff hisoblanmadi (${options.model} ${entityId}): ${String(error)}`,
        );
      }
    }

    await this.audit.log({
      action: options.action,
      entityType: options.entityType,
      entityId,
      changes: changes.length > 0 ? changes : undefined,
    });
  }

  private resolveId(
    options: AuditOptions,
    paramId: string | undefined,
    response: unknown,
  ): string | undefined {
    if (options.idFrom === 'param') return paramId;

    const fromResponse =
      response !== null && typeof response === 'object' && 'id' in response
        ? (response as { id?: unknown }).id
        : undefined;

    if (options.idFrom === 'response') {
      return typeof fromResponse === 'string' ? fromResponse : undefined;
    }

    return (
      paramId ?? (typeof fromResponse === 'string' ? fromResponse : undefined)
    );
  }

  /** So'rov tanasi — `model` berilmagan holatlar uchun (yaratish, login) */
  private fromBody(
    body: unknown,
  ): { field: string; old: unknown; new: unknown }[] {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return [];
    }

    return Object.entries(body as Record<string, unknown>)
      .filter(([field]) => !REDACTED.has(field))
      .map(([field, value]) => ({ field, old: null, new: value ?? null }));
  }

  /**
   * Prisma modeliga nom bo'yicha murojaat. Model nomi `@Audit()` dan keladi — ya'ni
   * kodda yozilgan konstanta, foydalanuvchi kiritgan qiymat emas.
   */
  private async findById(
    model: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const delegate = (
      this.prisma.db as unknown as Record<
        string,
        {
          findUnique?: (args: {
            where: { id: string };
          }) => Promise<Record<string, unknown> | null>;
        }
      >
    )[model];

    if (!delegate?.findUnique) return null;
    return delegate.findUnique({ where: { id } });
  }
}

/** Maxfiy maydonlarni olib tashlaydi va `Decimal`/`Date` ni solishtirsa bo'ladigan holga keltiradi */
function sanitize(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(row)) {
    if (REDACTED.has(field)) continue;
    result[field] =
      value instanceof Date ? value.toISOString() : (value ?? null);
  }

  return result;
}
