import { createIsomorphicFn } from '@tanstack/react-start';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import i18next, { type i18n as I18nInstance } from 'i18next';
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

/** The languages the bundles below cover, in fallback order. */
const supportedLngs = ['hu', 'en'] as const;

type Language = (typeof supportedLngs)[number];

const instances = new Map<Language, I18nInstance>();

/**
 * One i18next instance per language, created on first use.
 *
 * A per-request instance rebuilt the same resources, translator and `Intl`
 * caches for every render; instances are keyed by language instead, because a
 * single shared one would leak the first request's language into every later
 * one — `changeLanguage` is a mutation, not an argument. Sharing an instance
 * between requests of one language is safe: the language is fixed at creation
 * and server renders only read from it, so nothing mutates it mid-render. In
 * the browser it is the instance the provider renders and `changeLanguage`
 * updates, so the map holds the one the app is actually using.
 *
 * The passed language is normalized rather than used as a key as-is: it comes
 * from the `filc.language` cookie, so an unnormalized key would let a caller
 * grow the map without bound.
 *
 * The translations are bundled rather than fetched: with `resources` set,
 * i18next initializes synchronously, so a server render already has the text
 * (and the browser no longer waits on a request before the first paint). The
 * language is always passed in, so only the browser detects it — and caches it
 * in the cookie the next render reads.
 */
export const createI18n = (language: string) => {
  const lng: Language = supportedLngs.includes(language as Language)
    ? (language as Language)
    : 'hu';
  const cached = instances.get(lng);
  // An instance is mutable — `changeLanguage` rewrites it in place — so
  // holding the cache key is not proof it still holds that language. In the
  // browser a switch moves the instance off the key it was cached under, and
  // returning it for the original language would hand the caller the wrong one.
  if (cached && cached.language === lng) {
    return cached;
  }

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
    lng,
    react: {
      // The render must not block on a namespace: what is not translated yet
      // falls back to the key, which is what a browser render used to do too.
      useSuspense: false,
    },
    resources,
    supportedLngs: [...supportedLngs],
  });
  instances.set(lng, i18n);
  return i18n;
};
