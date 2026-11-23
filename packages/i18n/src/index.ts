import { createInstance, type TFunction } from 'i18next';
import { type Locale, resources } from './resources';

// The package entry point is the one place that re-exports the public surface.
// biome-ignore lint/performance/noBarrelFile: package entry point
export {
  formatMailDate,
  formatMailDateWithWeekday,
  periodLabel,
  WEEKDAY_NAMES_EN,
  WEEKDAY_NAMES_HU,
  weekdayOn,
} from './formatters';
export type { Locale } from './resources';

/**
 * The language a notification or mail is written in. The stored column is free
 * text (`en-GB`, an empty string, a code we do not translate), so the BCP-47
 * primary tag decides and anything that is not English falls back to
 * Hungarian, the column's default.
 */
export function normalizeLocale(locale?: string): Locale {
  return (locale ?? '').trim().toLowerCase().split('-')[0] === 'en'
    ? 'en'
    : 'hu';
}

const i18n = createInstance();

// i18next 26 renamed the old `initImmediate: false` to `initAsync: false`:
// both mean "load the bundled resources synchronously", so `init` has filled
// the store by the time it returns and the translators below never see an
// empty namespace. Nothing can fail: there is no backend, only bundled JSON.
i18n.init({
  defaultNS: 'notifications',
  fallbackLng: 'hu',
  initAsync: false,
  interpolation: { escapeValue: false },
  lng: 'hu',
  ns: ['notifications'],
  resources,
});

const translators = new Map<Locale, TFunction<'notifications'>>();

/**
 * The translator for a locale, resolved with the same rule as the stored
 * preference (anything not English is Hungarian). Instances are cached, so a
 * notification pipeline building hundreds of messages pays for `getFixedT`
 * once per locale.
 */
export function createTranslator(locale?: string): TFunction<'notifications'> {
  const resolved = normalizeLocale(locale);
  const cached = translators.get(resolved);
  if (cached) {
    return cached;
  }
  const translator = i18n.getFixedT(resolved, 'notifications');
  translators.set(resolved, translator);
  return translator;
}
