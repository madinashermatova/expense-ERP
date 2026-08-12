import { Language } from '../../generated/prisma/enums';

/** TZ 4.3 — o'zbek (lotin) va rus */
export const SUPPORTED_LANGUAGES = ['uz', 'ru'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'uz';

/** Prisma `Language` enum idan i18n kodiga */
export function toAppLanguage(
  language: Language | null | undefined,
): AppLanguage {
  return language === Language.RU ? 'ru' : 'uz';
}

export function isAppLanguage(value: string): value is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** i18n kodidan Prisma `Language` enum iga */
export function fromAppLanguage(lang: AppLanguage): Language {
  return lang === 'ru' ? Language.RU : Language.UZ;
}
