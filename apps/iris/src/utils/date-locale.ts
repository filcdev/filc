import { enUS, hu } from 'date-fns/locale';

type DateInput = Date | number | string;

function getLanguageCode(language: string | undefined): string {
  return (language ?? 'hu').toLowerCase().split('-')[0] ?? 'hu';
}

export function getIntlLocale(language: string | undefined): string {
  return getLanguageCode(language) === 'en' ? 'en-US' : 'hu-HU';
}

type WeekdayFormat = 'long' | 'short' | 'narrow';

export function getDateFnsLocale(language: string | undefined) {
  return getLanguageCode(language) === 'en' ? enUS : hu;
}

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatLocalizedDate(
  value: DateInput,
  language: string | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(getIntlLocale(language), options).format(
    toDate(value)
  );
}

export function normalizeDayText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const weekdayAliases: Record<number, string[]> = {
  0: ['vasarnap', 'va', 'v', 'sunday', 'sun'],
  1: ['hetfo', 'he', 'h', 'monday', 'mon'],
  2: ['kedd', 'ke', 'k', 'tuesday', 'tue'],
  3: ['szerda', 'sze', 'sz', 'wednesday', 'wed'],
  4: ['csutortok', 'cs', 'thursday', 'thu'],
  5: ['pentek', 'pe', 'p', 'friday', 'fri'],
  6: ['szombat', 'szo', 'saturday', 'sat'],
};

export function isMatchingWeekday(
  weekdayIndex: number,
  dayName: string,
  dayShort?: string
): boolean {
  const aliases = (weekdayAliases[weekdayIndex] ?? []).map(normalizeDayText);
  const normalizedName = normalizeDayText(dayName);
  const normalizedShort = dayShort ? normalizeDayText(dayShort) : '';

  return aliases.some(
    (alias) =>
      normalizedName === alias ||
      normalizedShort === alias ||
      normalizedName.includes(alias)
  );
}

const dayOrderMap = new Map<string, number>([
  ['he', 0],
  ['hetfo', 0],
  ['mon', 0],
  ['monday', 0],
  ['ke', 1],
  ['kedd', 1],
  ['tue', 1],
  ['tuesday', 1],
  ['sz', 2],
  ['sze', 2],
  ['szerda', 2],
  ['wed', 2],
  ['wednesday', 2],
  ['cs', 3],
  ['csutortok', 3],
  ['thu', 3],
  ['thursday', 3],
  ['pe', 4],
  ['pentek', 4],
  ['fri', 4],
  ['friday', 4],
  ['szo', 5],
  ['szombat', 5],
  ['sat', 5],
  ['saturday', 5],
  ['va', 6],
  ['vasarnap', 6],
  ['sun', 6],
  ['sunday', 6],
]);

export function getDayOrder(dayName: string, dayShort?: string): number {
  const byShort = dayShort ? dayOrderMap.get(normalizeDayText(dayShort)) : null;
  if (byShort !== undefined && byShort !== null) {
    return byShort;
  }

  const byName = dayOrderMap.get(normalizeDayText(dayName));
  if (byName !== undefined) {
    return byName;
  }

  return 999;
}

export function getLocalizedWeekdayName(
  dayName: string,
  dayShort: string | undefined,
  language: string | undefined,
  format: WeekdayFormat = 'long'
): string {
  const order = getDayOrder(dayName, dayShort);
  if (order === 999) {
    return dayShort ?? dayName;
  }

  const jsWeekdayIndex = (order + 1) % 7; // Convert Monday-based order to JS Sunday-based order.
  const baseSundayUtc = Date.UTC(2024, 0, 7);
  const date = new Date(baseSundayUtc + jsWeekdayIndex * 24 * 60 * 60 * 1000);

  return new Intl.DateTimeFormat(getIntlLocale(language), {
    timeZone: 'UTC',
    weekday: format,
  }).format(date);
}
