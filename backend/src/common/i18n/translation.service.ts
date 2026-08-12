import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { AppLanguage, DEFAULT_LANGUAGE, isAppLanguage } from './languages';

/**
 * Tarjima kirish nuqtasi (TZ 4.3, 5.4).
 *
 * Til uch manbadan aniqlanadi, aynan shu tartibda:
 * 1. **Foydalanuvchining sozlamasi** (`User.language`, kontekstga token tekshirilganda
 *    tushadi) — u ataylab birinchi: foydalanuvchi tilni tizimda tanlagan, brauzer
 *    sarlavhasi esa boshqa bo'lishi mumkin.
 * 2. `nestjs-i18n` konteksti — `?lang=`, `x-lang` yoki `Accept-Language`
 *    (autentifikatsiyadan o'tmagan so'rovlar uchun asosiy manba).
 * 3. Fallback — `uz`.
 *
 * Kalit topilmasa `nestjs-i18n` kalitning o'zini qaytaradi; bu yerda u `null` ga
 * aylantiriladi, ya'ni chaqiruvchi "tarjima yo'q" holatini aniq ko'radi va
 * foydalanuvchiga kalit nomi ko'rinib qolmaydi.
 */
@Injectable()
export class TranslationService {
  constructor(
    private readonly i18n: I18nService,
    private readonly tenantContext: TenantContextService,
  ) {}

  get language(): AppLanguage {
    const fromUser = this.tenantContext.store?.language;
    if (fromUser) return fromUser;

    const fromRequest = I18nContext.current()?.lang;
    if (fromRequest && isAppLanguage(fromRequest)) return fromRequest;

    return DEFAULT_LANGUAGE;
  }

  /** Tarjima; kalit topilmasa `null` */
  translate(
    key: string,
    options: { args?: Record<string, unknown>; lang?: AppLanguage } = {},
  ): string | null {
    const lang = options.lang ?? this.language;
    const value = this.i18n.translate<string>(key, {
      lang,
      args: options.args,
      defaultValue: '',
    });

    if (typeof value !== 'string' || value === '' || value === key) return null;
    return value;
  }

  /** Tarjima; topilmasa kalit o'rniga berilgan zaxira matn */
  translateOr(
    key: string,
    fallback: string,
    options: { args?: Record<string, unknown>; lang?: AppLanguage } = {},
  ): string {
    return this.translate(key, options) ?? fallback;
  }
}
