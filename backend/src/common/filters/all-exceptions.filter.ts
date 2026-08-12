import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorArgs } from '../errors/app-error';
import { decodeValidationMessage } from '../errors/validation-error';
import { TranslationService } from '../i18n/translation.service';

/** TZ 5.4 — yagona xato formati */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
  /** 429 uchun — necha soniyadan keyin qayta urinish mumkin */
  retryAfter?: number;
}

/** Tarjimadan oldingi ko'rinish: matn emas, kalit va argumentlar */
interface ResolvedError {
  statusCode: number;
  code: string;
  messageKey: string;
  args?: ErrorArgs;
  /** Kalit topilmasa ishlatiladigan matn (uchinchi tomon xatolari uchun) */
  fallbackMessage?: string;
  details?: Record<string, string[]>;
  retryAfter?: number;
}

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

/**
 * Barcha xatolarni yagona formatga keltiradi va **shu yerda tarjima qiladi** (TZ 4.3, 5.4).
 *
 * Tarjima ataylab markazda: servislar faqat `code` + `messageKey` + `args` beradi, ya'ni
 * biznes kodida matn qolmaydi va yangi til qo'shish faqat JSON fayl qo'shishdan iborat.
 * Kalit topilmasa xato baribir mazmunli chiqadi: `fallbackMessage` yoki status bo'yicha
 * umumiy xabar ishlatiladi.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly translations: TranslationService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const resolved = this.resolve(exception);
    const body: ApiErrorBody = {
      statusCode: resolved.statusCode,
      code: resolved.code,
      message: this.message(resolved),
      ...(resolved.details
        ? { details: this.translateDetails(resolved.details) }
        : {}),
      ...(resolved.retryAfter !== undefined
        ? { retryAfter: resolved.retryAfter }
        : {}),
    };

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.statusCode} ${body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (body.retryAfter !== undefined) {
      response.setHeader('Retry-After', String(body.retryAfter));
    }

    response.status(body.statusCode).json(body);
  }

  private message(resolved: ResolvedError): string {
    const translated = this.translations.translate(resolved.messageKey, {
      args: resolved.args,
    });
    if (translated) return translated;

    if (resolved.fallbackMessage) return resolved.fallbackMessage;

    return this.translations.translateOr(
      `errors.${DEFAULT_CODES[resolved.statusCode] ?? 'ERROR'}`,
      resolved.code,
    );
  }

  /**
   * `details` ichidagi validatsiya xabarlari ham tarjima qilinadi: ular kalit
   * ko'rinishida keladi (`validation.MONEY_FORMAT|{…}`), chunki `ValidationPipe`
   * so'rov tilini bilmasligi kerak. Kalit bo'lmagan qiymatlar (masalan bizning
   * `{ amount: ['150000'] }` kabi tafsilotlar) o'z holida qoladi.
   */
  private translateDetails(
    details: Record<string, string[]>,
  ): Record<string, string[]> {
    const out: Record<string, string[]> = {};

    for (const [field, messages] of Object.entries(details)) {
      out[field] = messages.map((message) => {
        const decoded = decodeValidationMessage(message);
        if (!decoded) return message;

        return this.translations.translateOr(
          decoded.key,
          decoded.fallback ??
            this.translations.translateOr('validation.unknown', message),
          { args: decoded.args },
        );
      });
    }

    return out;
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // Nest ning o'z xatolari (`new NotFoundException('...')`) — matn tayyor
      if (typeof payload === 'string') {
        const code = DEFAULT_CODES[status] ?? 'ERROR';
        return {
          statusCode: status,
          code,
          messageKey: `errors.${code}`,
          fallbackMessage: payload,
        };
      }

      const obj = payload as Record<string, unknown>;

      // class-validator xatolari: { message: string[], error, statusCode }
      if (Array.isArray(obj.message)) {
        return {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          code: 'VALIDATION_FAILED',
          messageKey: 'errors.VALIDATION_FAILED',
          details: { _: obj.message as string[] },
        };
      }

      // Servislar semantik statusni payload da beradi (masalan `BadRequestException`
      // ichida `statusCode: 422`) — HTTP javob ham aynan shu status bilan chiqadi.
      const effective =
        typeof obj.statusCode === 'number' ? obj.statusCode : status;
      const code =
        typeof obj.code === 'string'
          ? obj.code
          : (DEFAULT_CODES[effective] ?? 'ERROR');

      return {
        statusCode: effective,
        code,
        messageKey:
          typeof obj.messageKey === 'string'
            ? obj.messageKey
            : `errors.${code}`,
        ...(obj.args ? { args: obj.args as ErrorArgs } : {}),
        ...(typeof obj.message === 'string'
          ? { fallbackMessage: obj.message }
          : {}),
        ...(obj.details
          ? { details: obj.details as Record<string, string[]> }
          : {}),
        ...(obj.retryAfter !== undefined
          ? { retryAfter: obj.retryAfter as number }
          : {}),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      messageKey: 'errors.INTERNAL_ERROR',
    };
  }
}
