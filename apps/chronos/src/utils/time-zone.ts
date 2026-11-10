/**
 * The school's wall-clock timezone: the school's own clock, used as the fallback
 * when `CHRONOS_TIME_ZONE` is unset. Runtime code reads the configured zone from
 * `env.timeZone`; this constant only supplies the default.
 *
 * Kept in this leaf module (no app imports) so `#utils/environment` can import
 * it without a cycle through `#utils/date`.
 */
export const DEFAULT_TIME_ZONE = 'Europe/Budapest' as const;

// Probing the ICU time-zone database is the only way to validate an IANA name.
// An unknown zone is a configuration error, not a recoverable case, so it must
// fail the env parse rather than silently fall back.
export const isTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const WEEKDAY_INDEX: Record<string, number> = {
  Fri: 5,
  Mon: 1,
  Sat: 6,
  Sun: 0,
  Thu: 4,
  Tue: 2,
  Wed: 3,
};

// One formatter per zone: the zone is configuration, not a constant, so a single
// module-level formatter would bake in whatever was configured at import time.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * `hourCycle: 'h23'` is required: without it some locales render midnight as `24`.
 * `weekday: 'short'` rides along so the date and the weekday always come from the
 * same wall clock.
 */
const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatterCache.get(timeZone);
  if (cached !== undefined) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    weekday: 'short',
    year: 'numeric',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
};

export type ZonedDateTimeParts = {
  day: string;
  hour: string;
  minute: string;
  month: string;
  second: string;
  weekday: string;
  year: string;
};

const partValue = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string => {
  const value = parts.find((part) => part.type === type)?.value;
  if (value === undefined) {
    throw new Error(`Missing ${type} in formatted date parts`);
  }
  return value;
};

/** Wall-clock components of `date` in `timeZone`, all as strings. */
export const getZonedDateTimeParts = (
  date: Date,
  timeZone: string
): ZonedDateTimeParts => {
  const parts = formatterFor(timeZone).formatToParts(date);
  return {
    day: partValue(parts, 'day'),
    hour: partValue(parts, 'hour'),
    minute: partValue(parts, 'minute'),
    month: partValue(parts, 'month'),
    second: partValue(parts, 'second'),
    weekday: partValue(parts, 'weekday'),
    year: partValue(parts, 'year'),
  };
};

/**
 * A `Date` as `YYYY-MM-DD` in `timeZone`.
 *
 * Assembled from `formatToParts` rather than `toLocaleDateString('en-CA')`:
 * the locale's format is not guaranteed to be ISO-shaped across runtimes/ICU
 * builds, while the parts are.
 */
export const formatDateInTimeZone = (date: Date, timeZone: string): string => {
  const { day, month, year } = getZonedDateTimeParts(date, timeZone);
  return `${year}-${month}-${day}`;
};

/** UTC offset of `timeZone` at `date`, in minutes. */
export const offsetMinutesAt = (date: Date, timeZone: string): number => {
  const { day, hour, minute, month, second, year } = getZonedDateTimeParts(
    date,
    timeZone
  );

  // The zone's wall clock, reinterpreted as if it were UTC.
  const wallClockAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  // `|| 0` normalises the `-0` this yields for a zero-offset zone (e.g. UTC)
  // whenever `date` carries milliseconds, so the response never serialises `-0`.
  return Math.round((wallClockAsUtc - date.getTime()) / 60_000) || 0;
};

/** Weekday index (0 = Sunday … 6 = Saturday) for `date` in `timeZone`. */
export const getWeekdayInTimeZone = (date: Date, timeZone: string): number => {
  const { weekday } = getZonedDateTimeParts(date, timeZone);
  const weekdayIndex = WEEKDAY_INDEX[weekday];
  if (weekdayIndex === undefined) {
    throw new Error(`Unsupported weekday value: ${weekday}`);
  }
  return weekdayIndex;
};
