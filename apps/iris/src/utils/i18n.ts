import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import base from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

dayjs.extend(duration);

base
  .use(Backend)
  // Detect language from cookie/local, must come before react init
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    debug: import.meta.env.DEV,
    detection: {
      caches: ['cookie'],
      // i18next-browser-languagedetector expects minutes
      cookieMinutes: dayjs.duration(1, 'year').asMinutes(),
      cookieOptions: { path: '/', sameSite: 'lax' },
      lookupCookie: 'filc.language',
      lookupLocalStorage: '',
      // Prefer cookie, then fall back to <html lang>
      order: ['cookie', 'htmlTag'],
    },
    fallbackLng: 'hu',

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    react: {
      useSuspense: !(typeof window === 'undefined'),
    },
    supportedLngs: ['en', 'hu'],
  });

export const i18n = base;
