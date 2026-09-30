import { createIsomorphicFn } from '@tanstack/react-start';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import enPolicy from '../../public/locales/en/policy.json';
import enTranslation from '../../public/locales/en/translation.json';
import huPolicy from '../../public/locales/hu/policy.json';
import huTranslation from '../../public/locales/hu/translation.json';

dayjs.extend(duration);

const resources = {
  en: { policy: enPolicy, translation: enTranslation },
  hu: { policy: huPolicy, translation: huTranslation },
};

const isBrowser = () =>
  createIsomorphicFn()
    .client(() => true)
    .server(() => false)();

/**
 * One i18next instance per render: a module-level singleton would leak the
 * first request's language into every later one.
 *
 * The translations are bundled rather than fetched: with `resources` set,
 * i18next initializes synchronously, so a server render already has the text
 * (and the browser no longer waits on a request before the first paint). The
 * language is always passed in, so only the browser detects it — and caches it
 * in the cookie the next render reads.
 */
export const createI18n = (language: string) => {
  const i18n = i18next.createInstance();
  if (isBrowser()) {
    i18n.use(LanguageDetector);
  }
  i18n.use(initReactI18next).init({
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
    lng: language,
    react: {
      // The render must not block on a namespace: what is not translated yet
      // falls back to the key, which is what a browser render used to do too.
      useSuspense: false,
    },
    resources,
    supportedLngs: ['en', 'hu'],
  });
  return i18n;
};
