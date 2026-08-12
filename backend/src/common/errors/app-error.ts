import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';

/** i18n xabariga qo'yiladigan qiymatlar (`{limit}`, `{status}`, …) */
export type ErrorArgs = Record<string, string | number>;

export interface AppErrorInit {
  /** HTTP status; berilmasa 422 (TZ ko'p joyda aynan shuni talab qiladi) */
  status?: number;
  /**
   * i18n kaliti. Sukut bo'yicha `errors.<CODE>`; bir xil kod turli kontekstda
   * boshqacha o'qilishi kerak bo'lganda aniq kalit beriladi
   * (masalan `errors.NOT_FOUND_EXPENSE`), lekin **kod o'zgarmaydi** — u API kontrakti.
   */
  messageKey?: string;
  args?: ErrorArgs;
  /** Maydon bo'yicha tafsilot: `{ amount: ['150000'] }` */
  details?: Record<string, string[]>;
  /** 429 uchun */
  retryAfter?: number;
}

/** Xato javobining tanasi — `AllExceptionsFilter` shu shaklni kutadi */
export interface AppErrorPayload {
  statusCode: number;
  code: string;
  messageKey: string;
  args?: ErrorArgs;
  details?: Record<string, string[]>;
  retryAfter?: number;
}

/** Status → Nest exception klassi (turlar saqlanadi, pastdagi izohga qarang) */
const BY_STATUS: Record<number, (payload: AppErrorPayload) => HttpException> = {
  [HttpStatus.UNAUTHORIZED]: (p) => new UnauthorizedException(p),
  [HttpStatus.FORBIDDEN]: (p) => new ForbiddenException(p),
  [HttpStatus.NOT_FOUND]: (p) => new NotFoundException(p),
  [HttpStatus.CONFLICT]: (p) => new ConflictException(p),
  [HttpStatus.PAYLOAD_TOO_LARGE]: (p) => new PayloadTooLargeException(p),
};

/**
 * Yagona xato konstruktori (TZ 5.4).
 *
 * Xabar matni **bu yerda yo'q**: servis faqat kod, kalit va argumentlarni beradi,
 * tarjima esa filterda so'rov tiliga qarab qilinadi (TZ 4.3 — hardcode matn yo'q).
 *
 * Nest ning aniq exception klassi ataylab saqlanadi: kod ba'zi joylarda turi bo'yicha
 * tekshiriladi (masalan bot idempotentligida `ConflictException`), shuning uchun
 * umumiy `HttpException` qaytarish xatti-harakatni jimgina o'zgartirardi.
 */
export function appError(code: string, init: AppErrorInit = {}): HttpException {
  const status = init.status ?? HttpStatus.UNPROCESSABLE_ENTITY;

  const payload: AppErrorPayload = {
    statusCode: status,
    code,
    messageKey: init.messageKey ?? `errors.${code}`,
    ...(init.args ? { args: init.args } : {}),
    ...(init.details ? { details: init.details } : {}),
    ...(init.retryAfter !== undefined ? { retryAfter: init.retryAfter } : {}),
  };

  const factory = BY_STATUS[status];
  if (factory) return factory(payload);

  /*
   * 422 uchun ham `BadRequestException`: Nest da 422 klassi yo'q, tanadagi
   * `statusCode` esa filterda ustun turadi va javob 422 bo'lib chiqadi.
   */
  return new BadRequestException(payload);
}

export const unprocessable = (
  code: string,
  init: Omit<AppErrorInit, 'status'> = {},
): HttpException => appError(code, { ...init, status: 422 });

export const badRequest = (
  code: string,
  init: Omit<AppErrorInit, 'status'> = {},
): HttpException => appError(code, { ...init, status: HttpStatus.BAD_REQUEST });

export const notFound = (
  code = 'NOT_FOUND',
  init: Omit<AppErrorInit, 'status'> = {},
): HttpException => appError(code, { ...init, status: HttpStatus.NOT_FOUND });

export const forbidden = (
  code = 'FORBIDDEN',
  init: Omit<AppErrorInit, 'status'> = {},
): HttpException => appError(code, { ...init, status: HttpStatus.FORBIDDEN });

export const conflict = (
  code: string,
  init: Omit<AppErrorInit, 'status'> = {},
): HttpException => appError(code, { ...init, status: HttpStatus.CONFLICT });

export const unauthorized = (
  code = 'UNAUTHORIZED',
  init: Omit<AppErrorInit, 'status'> = {},
): HttpException =>
  appError(code, { ...init, status: HttpStatus.UNAUTHORIZED });
