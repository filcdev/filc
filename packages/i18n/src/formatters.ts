import type { Locale } from './resources';

/** Full English weekday names, Sunday-first (`Date#getDay()` order). */
export const WEEKDAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Full Hungarian weekday names, Sunday-first (`Date#getDay()` order). */
export const WEEKDAY_NAMES_HU = [
  'Vasárnap',
  'Hétfő',
  'Kedd',
  'Szerda',
  'Csütörtök',
  'Péntek',
  'Szombat',
] as const;

/**
 * The Hungarian weekday in the "-on/-en/-ön" form a sentence needs
 * ("hétfőn", "kedden", "szerdán", "csütörtökön", "pénteken", "szombaton",
 * "vasárnap"). The suffix is not derivable from the name and `Intl` does not
 * produce it, so the inflected forms have to be listed.
 */
const WEEKDAY_NAMES_HU_ON = [
  'vasárnap',
  'hétfőn',
  'kedden',
  'szerdán',
  'csütörtökön',
  'pénteken',
  'szombaton',
] as const;

const pad = (value: number): string => String(value).padStart(2, '0');

/** `YYYY-MM-DD` in English, `YYYY. MM. DD.` in Hungarian. */
export function formatMailDate(date: Date, locale: Locale): string {
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  return locale === 'en'
    ? `${year}-${month}-${day}`
    : `${year}. ${month}. ${day}.`;
}

/** `{weekday}, {date}`, e.g. `Tuesday, 2026-11-17` / `Kedd, 2026. 11. 17.` */
export function formatMailDateWithWeekday(date: Date, locale: Locale): string {
  const names = locale === 'en' ? WEEKDAY_NAMES_EN : WEEKDAY_NAMES_HU;
  const weekday = names[date.getDay()] ?? '';
  return `${weekday}, ${formatMailDate(date, locale)}`;
}

/** `Period 3` / `3. óra`; a period number may arrive as a string from the DB. */
export function periodLabel(period: number | string, locale: Locale): string {
  return locale === 'en' ? `Period ${period}` : `${period}. óra`;
}

/**
 * The weekday at `index` (`Date#getDay()` order) as it reads inside a sentence:
 * the plain name in English, the "-on/-en/-ön" form in Hungarian.
 */
export function weekdayOn(index: number, locale: Locale): string {
  const names = locale === 'en' ? WEEKDAY_NAMES_EN : WEEKDAY_NAMES_HU_ON;
  return names[index] ?? '';
}
