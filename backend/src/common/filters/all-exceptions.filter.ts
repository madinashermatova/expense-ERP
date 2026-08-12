import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TenantContextService } from '../tenancy/tenant-context.service';

/** TZ 5.4 — yagona xato formati */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
  /** 429 uchun — necha soniyadan keyin qayta urinish mumkin */
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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const body = this.toBody(exception);

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

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return {
          statusCode: status,
          code: DEFAULT_CODES[status] ?? 'ERROR',
          message: payload,
        };
      }

      const obj = payload as Record<string, unknown>;

      // class-validator xatolari: { message: string[], error, statusCode }
      if (Array.isArray(obj.message)) {
        return {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          code: 'VALIDATION_FAILED',
          message: "Kiritilgan ma'lumot noto'g'ri",
          details: { _: obj.message as string[] },
        };
      }

      return {
        statusCode: status,
        code: (obj.code as string) ?? DEFAULT_CODES[status] ?? 'ERROR',
        message: (obj.message as string) ?? 'Xatolik',
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
      message: 'Ichki xatolik',
    };
  }
}
