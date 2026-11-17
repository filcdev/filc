/**
 * The one piece of theme-selection logic the backend owns: which skin is in
 * season today.
 *
 * Deliberately pure — no database, no logger, no app imports — because it runs
 * inside `GET /theme`, the endpoint in every visitor's first paint. The caller
 * loads the schedule rows and supplies today's wall-clock date in the school's
 * time zone.
 *
 * Resolution order:
 * 1. Easter (movable, so code rather than a row) — wins over every row.
 * 2. The schedule row whose annual window contains today.
 * 3. Nothing in season — the caller falls back to the manually pinned skin.
 */

/** A month/day pair without a year; `annual` windows repeat every year. */
export type AnnualWindow = {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
};

/** A schedule row: its window plus the skin it selects. */
export type ScheduledWindow = AnnualWindow & { theme: string };

/** A calendar day, as the school's wall clock sees it. */
export type CalendarDay = { year: number; month: number; day: number };

/**
 * The skin Easter selects. There is no row for it: Easter Sunday moves between
 * 22 March and 25 April, which a month/day pair cannot express.
 */
const EASTER_THEME = 'easter';

/** Days in each month of a leap year, so 29 February is representable. */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** `MMDD` as one number, so a window is a plain range comparison. */
const ordinal = (month: number, day: number): number => month * 100 + day;

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** 1-based day of the year; the basis for offsets around a movable feast. */
const dayOfYear = (year: number, month: number, day: number): number => {
  let total = day;
  for (let m = 1; m < month; m += 1) {
    total += DAYS_IN_MONTH[m - 1] + (m === 2 && isLeapYear(year) ? 1 : 0);
  }
  return total;
};

/** True when `month`/`day` is a real calendar day (29 February is accepted). */
export const isRealMonthDay = (month: number, day: number): boolean => {
  const max = DAYS_IN_MONTH[month - 1];
  return max !== undefined && day >= 1 && day <= max;
};

/**
 * Inclusive containment, wrap-around aware: `12-28 → 01-02` contains 31
 * December and 1 January, and a single-day window (`start === end`) contains
 * exactly that day.
 */
export const windowContains = (
  window: AnnualWindow,
  month: number,
  day: number
): boolean => {
  const start = ordinal(window.startMonth, window.startDay);
  const end = ordinal(window.endMonth, window.endDay);
  const today = ordinal(month, day);

  return start <= end
    ? today >= start && today <= end
    : today >= start || today <= end;
};

/**
 * Gregorian Easter Sunday (Meeus/Jones/Butcher). Valid for any year in the
 * 1583–4099 range the algorithm is defined for, which is every year the school
 * will care about.
 */
export const easterSunday = (year: number): { month: number; day: number } => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return { day, month };
};

/**
 * Easter's window: the week before Easter Sunday through Easter Monday. The
 * Easter date never falls near a year boundary (22 March – 25 April), so the
 * window cannot wrap and a day-of-year offset is exact.
 */
export const easterWindowContains = (
  year: number,
  month: number,
  day: number
): boolean => {
  const easter = easterSunday(year);
  const offset =
    dayOfYear(year, month, day) - dayOfYear(year, easter.month, easter.day);

  return offset >= -7 && offset <= 1;
};

/**
 * The skin for `today`, or null when nothing is in season and the caller should
 * use the manually pinned one. Easter wins over any row, so a row overlapping
 * it never shadows the feast.
 */
export const activeThemeFor = (
  rows: readonly ScheduledWindow[],
  today: CalendarDay
): string | null => {
  if (easterWindowContains(today.year, today.month, today.day)) {
    return EASTER_THEME;
  }

  const row = rows.find((candidate) =>
    windowContains(candidate, today.month, today.day)
  );

  return row?.theme ?? null;
};

/**
 * Whether two annual windows share at least one calendar day. A day-by-day scan
 * over a leap year is the obviously-correct implementation — windows are
 * month/day ranges that may wrap the year end, and this is a handful of rows on
 * an admin write path, not a hot loop.
 */
export const windowsOverlap = (a: AnnualWindow, b: AnnualWindow): boolean => {
  for (let month = 1; month <= 12; month += 1) {
    for (let day = 1; day <= DAYS_IN_MONTH[month - 1]; day += 1) {
      if (windowContains(a, month, day) && windowContains(b, month, day)) {
        return true;
      }
    }
  }

  return false;
};
