import { env } from '@/utils/environment';
import { getWeekdayInTimeZone } from '@/utils/time-zone';

/** Normalize a day name for accent/case-insensitive matching. */
const normalizeDayText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Weekday index (0 = Sunday … 6 = Saturday) for a date in the configured school timezone. */
export const getWeekdayInSchoolTimeZone = (value: Date): number =>
  getWeekdayInTimeZone(value, env.timeZone);

const weekdayAliases: Record<number, string[]> = {
  0: ['vasarnap', 'va', 'v', 'sunday', 'sun'],
  1: ['hetfo', 'he', 'h', 'monday', 'mon'],
  2: ['kedd', 'ke', 'k', 'tuesday', 'tue'],
  3: ['szerda', 'sze', 'sz', 'wednesday', 'wed'],
  4: ['csutortok', 'cs', 'thursday', 'thu'],
  5: ['pentek', 'pe', 'p', 'friday', 'fri'],
  6: ['szombat', 'szo', 'saturday', 'sat'],
};

/** Whether a day definition's name/short matches the given weekday index. */
export const isMatchingWeekday = (
  weekdayIndex: number,
  dayName: string,
  dayShort?: string
): boolean => {
  const aliases = new Set(
    (weekdayAliases[weekdayIndex] ?? []).map(normalizeDayText)
  );
  const normalizedName = normalizeDayText(dayName);
  const normalizedShort = dayShort ? normalizeDayText(dayShort) : '';

  return aliases.has(normalizedName) || aliases.has(normalizedShort);
};
