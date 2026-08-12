import { HttpException } from '@nestjs/common';
import { ValidationArguments, ValidationError } from 'class-validator';
import { unprocessable } from './app-error';

/**
 * `key|{"args":…}` shaklidagi kodlangan xabar. Aynan shu shakl `nestjs-i18n` ning
 * `i18nValidationMessage` funksiyasi bergan natija bilan bir xil, ya'ni DTO larda
 * ikkala usul (bizning kalitimiz va kutubxona helperi) yonma-yon ishlaydi.
 */
const SEPARATOR = '|';

export interface DecodedMessage {
  key: string;
  args: Record<string, unknown>;
  /** Kalit tarjimasi topilmasa ishlatiladi (class-validator ning o'z matni) */
  fallback?: string;
}

/** DTO da ishlatiladi: `@Matches(MONEY, { message: validationMessage('validation.MONEY_FORMAT') })` */
export function validationMessage(
  key: string,
): (args: ValidationArguments) => string {
  return (args: ValidationArguments) =>
    encode(key, { constraints: args.constraints, property: args.property });
}

export function encode(key: string, args: Record<string, unknown>): string {
  return `${key}${SEPARATOR}${JSON.stringify(args)}`;
}

export function decodeValidationMessage(raw: string): DecodedMessage | null {
  const index = raw.indexOf(SEPARATOR);
  if (index === -1) return null;

  const key = raw.slice(0, index);
  if (!key.startsWith('validation.')) return null;

  try {
    const parsed = JSON.parse(raw.slice(index + 1)) as Record<string, unknown>;
    const constraints = parsed.constraints;

    return {
      key,
      // `{constraints.0}` shaklidagi o'rin egalari uchun massiv obyektga aylantiriladi
      args: {
        ...parsed,
        ...(Array.isArray(constraints)
          ? {
              constraints: Object.fromEntries(
                constraints.map((value, i) => [String(i), value]),
              ),
            }
          : {}),
      },
      fallback:
        typeof parsed.fallback === 'string' ? parsed.fallback : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * `ValidationPipe` xatolarini yagona formatga keltiradi (TZ 5.4).
 *
 * Natija: `details` **maydon nomi bo'yicha** guruhlanadi (`{ amount: [...] }`) —
 * shu shakl xato javobini forma maydonlariga bevosita bog'lash imkonini beradi.
 *
 * Har bir xabar i18n kaliti ko'rinishida qoladi va **filterda** tarjima qilinadi:
 * DTO da o'z kaliti berilmagan bo'lsa, kalit class-validator qoidasining nomidan
 * quriladi (`isUuid` → `validation.isUuid`), kutubxonaning inglizcha matni esa
 * faqat zaxira sifatida saqlanadi.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): HttpException {
  return unprocessable('VALIDATION_FAILED', { details: flatten(errors) });
}

function flatten(
  errors: ValidationError[],
  prefix = '',
): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;

    for (const [rule, message] of Object.entries(error.constraints ?? {})) {
      const encoded = message.includes(SEPARATOR)
        ? message
        : encode(`validation.${rule}`, {
            constraints: constraintsOf(error, rule),
            fallback: message,
          });

      details[path] = [...(details[path] ?? []), encoded];
    }

    if (error.children?.length) {
      for (const [key, value] of Object.entries(
        flatten(error.children, path),
      )) {
        details[key] = [...(details[key] ?? []), ...value];
      }
    }
  }

  return details;
}

/**
 * class-validator `ValidationError` da qoida argumentlari saqlanmaydi (faqat tayyor
 * matn). Shuning uchun matndan sonli chegara ajratib olinadi — `minLength` kabi
 * qoidalarda xabar aynan shu songa tayanadi.
 */
function constraintsOf(error: ValidationError, rule: string): unknown[] {
  const message = error.constraints?.[rule] ?? '';
  const numbers = message.match(/\d+/g);
  return numbers ? [Number(numbers[0])] : [];
}
