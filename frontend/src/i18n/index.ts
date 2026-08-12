import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonUz from './locales/uz/common.json';
import commonRu from './locales/ru/common.json';
import refundsUz from './locales/uz/refunds.json';
import refundsRu from './locales/ru/refunds.json';
import editRequestsUz from './locales/uz/editRequests.json';
import editRequestsRu from './locales/ru/editRequests.json';

import settingsUz from './locales/uz/settings.json';
import settingsRu from './locales/ru/settings.json';

const resources = {
  uz: {
    common: commonUz,
    refunds: refundsUz,
    editRequests: editRequestsUz,
    settings: settingsUz,
  },
  ru: {
    common: commonRu,
    refunds: refundsRu,
    editRequests: editRequestsRu,
    settings: settingsRu,
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'uz', // default language
    fallbackLng: 'uz',
    interpolation: {
      escapeValue: false 
    },
    defaultNS: 'common',
  });

export default i18n;
