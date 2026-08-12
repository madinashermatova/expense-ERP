import { Injectable } from '@nestjs/common';
import { TranslationService } from '../../common/i18n/translation.service';
import { toAppLanguage } from '../../common/i18n/languages';
import { Language } from '../../generated/prisma/enums';

/**
 * Bildirishnoma matnlari (TZ 3.11, 4.3).
 *
 * Matn **serverda** tayyorlanadi: bir xil xabar Web badge ida ham, Telegram xabarida ham
 * ishlatiladi, ya'ni ikki mijozda takrorlamaslik kerak. Shablonlar
 * `src/i18n/{uz,ru}/notifications.json` da, kalit — bildirishnoma turi
 * (`EXPENSE_CREATED`, …), ya'ni yangi til qo'shish uchun kod o'zgarmaydi.
 *
 * Til **oluvchining** sozlamasidan olinadi (`User.language`), so'rov sarlavhasidan emas:
 * bildirishnoma fon jarayonida (navbat, cron) ham yasaladi, o'sha yerda so'rov yo'q.
 */
@Injectable()
export class NotificationTextService {
  constructor(private readonly translations: TranslationService) {}

  render(
    type: string,
    payload: unknown,
    language: Language = Language.UZ,
  ): string {
    const data =
      payload !== null && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};

    const text = this.translations.translate(`notifications.${type}`, {
      lang: toAppLanguage(language),
      args: scalarsOnly(data),
    });

    // Noma'lum tur — turning o'zi ko'rsatiladi, xabar yo'qolib ketmasligi uchun
    return text ?? type;
  }
}

/**
 * Ichma-ich obyekt matnga aylanmaydi — `[object Object]` xabarni buzardi.
 * Topilmagan o'rin egasi (`{reason}`) shablonda o'z holida qoladi.
 */
function scalarsOnly(
  payload: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
    }
  }

  return out;
}
