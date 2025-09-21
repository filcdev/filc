import base from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import Backend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

base
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'hu',
    supportedLngs: ['en', 'hu'],
    debug: true,
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    react: {
      useSuspense: !(typeof window === 'undefined'),
    },

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });

export const i18n = base;
