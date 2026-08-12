import { InternalServerErrorException } from '@nestjs/common';

/**
 * Eng xavfli nosozlik turi: biznes so'rovi tenant kontekstisiz bajarilmoqda.
 * TZ 3.16.1 — bunday holatda hech qachon "hammasini qaytarish" mumkin emas, xato beriladi.
 */
export class TenantContextMissingError extends InternalServerErrorException {
  constructor(model: string, operation: string) {
    super({
      statusCode: 500,
      code: 'TENANT_CONTEXT_MISSING',
      messageKey: 'errors.TENANT_CONTEXT_MISSING',
      // Texnik tafsilot faqat logda va `details` da — foydalanuvchiga tarjima chiqadi
      details: { context: [`${model}.${operation}`] },
    });
  }
}

/**
 * So'rovda boshqa kompaniyaning companyId si ataylab yoki xato bilan uzatilgan.
 */
export class CrossTenantWriteError extends InternalServerErrorException {
  constructor(model: string, expected: string, received: string) {
    super({
      statusCode: 500,
      code: 'CROSS_TENANT_WRITE',
      messageKey: 'errors.CROSS_TENANT_WRITE',
      details: { context: [`${model}: ${expected} ≠ ${received}`] },
    });
  }
}
