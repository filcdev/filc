import { describe, expect, test } from 'bun:test';
import {
  activeThemeFor,
  easterSunday,
  easterWindowContains,
  isRealMonthDay,
  resolveTheme,
  todayInTimeZone,
  windowContains,
  windowsOverlap,
} from '#modules/theme/utils/schedule';

const window = (
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number
) => ({ endDay, endMonth, startDay, startMonth });

describe('windowContains', () => {
  const halloween = window(10, 25, 11, 2);

  test('is true inside the window', () => {
    expect(windowContains(halloween, 10, 28)).toBe(true);
  });

  test('includes both boundary days', () => {
    expect(windowContains(halloween, 10, 25)).toBe(true);
    expect(windowContains(halloween, 11, 2)).toBe(true);
  });

  test('is false outside the window', () => {
    expect(windowContains(halloween, 10, 24)).toBe(false);
    expect(windowContains(halloween, 11, 3)).toBe(false);
  });

  test('supports a window that wraps the year end', () => {
    const newYear = window(12, 28, 1, 2);

    expect(windowContains(newYear, 12, 31)).toBe(true);
    expect(windowContains(newYear, 1, 1)).toBe(true);
    expect(windowContains(newYear, 1, 3)).toBe(false);
    expect(windowContains(newYear, 12, 27)).toBe(false);
  });

  test('contains exactly its day for a single-day window', () => {
    const oneDay = window(3, 15, 3, 15);

    expect(windowContains(oneDay, 3, 15)).toBe(true);
    expect(windowContains(oneDay, 3, 14)).toBe(false);
    expect(windowContains(oneDay, 3, 16)).toBe(false);
  });
});

describe('easterSunday', () => {
  test('matches the Gregorian computus for 2024–2027', () => {
    expect(easterSunday(2024)).toEqual({ day: 31, month: 3 });
    expect(easterSunday(2025)).toEqual({ day: 20, month: 4 });
    expect(easterSunday(2026)).toEqual({ day: 5, month: 4 });
    expect(easterSunday(2027)).toEqual({ day: 28, month: 3 });
  });
});

describe('easterWindowContains', () => {
  // Easter Sunday 2026 is 5 April, so the window is 29 March – 6 April.
  test('starts a week before Easter Sunday', () => {
    expect(easterWindowContains(2026, 3, 29)).toBe(true);
    expect(easterWindowContains(2026, 3, 28)).toBe(false);
  });

  test('runs through Easter Monday', () => {
    expect(easterWindowContains(2026, 4, 5)).toBe(true);
    expect(easterWindowContains(2026, 4, 6)).toBe(true);
    expect(easterWindowContains(2026, 4, 7)).toBe(false);
  });

  test('crosses the month boundary between March and April', () => {
    expect(easterWindowContains(2026, 3, 31)).toBe(true);
    expect(easterWindowContains(2026, 4, 1)).toBe(true);
  });

  // Easter Sunday 2024 is 31 March, so the window straddles a leap February:
  // 24 March – 1 April.
  test('is exact across the end of a leap February (2024)', () => {
    expect(easterWindowContains(2024, 3, 24)).toBe(true);
    expect(easterWindowContains(2024, 4, 1)).toBe(true);
    expect(easterWindowContains(2024, 3, 23)).toBe(false);
    expect(easterWindowContains(2024, 4, 2)).toBe(false);
  });

  // Easter Sunday 2027 is 28 March, the earliest it gets in this decade:
  // window 21 March – 29 March.
  test('holds for an early Easter (2027-03-28)', () => {
    expect(easterWindowContains(2027, 3, 21)).toBe(true);
    expect(easterWindowContains(2027, 3, 29)).toBe(true);
    expect(easterWindowContains(2027, 3, 20)).toBe(false);
    expect(easterWindowContains(2027, 3, 30)).toBe(false);
  });

  // Easter Sunday 2038 is 25 April, the latest date the computus can produce:
  // window 18 April – 26 April.
  test('holds for the latest possible Easter (2038-04-25)', () => {
    expect(easterWindowContains(2038, 4, 18)).toBe(true);
    expect(easterWindowContains(2038, 4, 26)).toBe(true);
    expect(easterWindowContains(2038, 4, 17)).toBe(false);
    expect(easterWindowContains(2038, 4, 27)).toBe(false);
  });
});

describe('windowsOverlap', () => {
  test('is false for disjoint windows', () => {
    expect(windowsOverlap(window(10, 1, 10, 31), window(12, 1, 12, 31))).toBe(
      false
    );
  });

  test('is true for identical windows', () => {
    expect(windowsOverlap(window(10, 1, 10, 31), window(10, 1, 10, 31))).toBe(
      true
    );
  });

  test('is true when a wrapping window crosses another', () => {
    expect(windowsOverlap(window(12, 28, 1, 2), window(1, 1, 1, 10))).toBe(
      true
    );
  });

  test('is false for two wrapping windows that do not meet', () => {
    expect(windowsOverlap(window(12, 28, 1, 2), window(1, 5, 1, 20))).toBe(
      false
    );
  });

  test('handles one-day windows', () => {
    expect(windowsOverlap(window(3, 15, 3, 15), window(3, 15, 3, 15))).toBe(
      true
    );
    expect(windowsOverlap(window(3, 15, 3, 15), window(3, 16, 3, 16))).toBe(
      false
    );
  });

  test('is true when one window contains the other', () => {
    expect(windowsOverlap(window(12, 1, 12, 31), window(12, 24, 12, 26))).toBe(
      true
    );
  });

  test('is false for windows touching without sharing a day', () => {
    expect(windowsOverlap(window(10, 1, 10, 31), window(11, 1, 11, 30))).toBe(
      false
    );
  });
});

describe('activeThemeFor', () => {
  const easterRow = {
    ...window(3, 29, 4, 6),
    theme: 'summer',
  };
  const halloweenRow = {
    ...window(10, 25, 11, 2),
    theme: 'halloween',
  };
  const rows = [easterRow, halloweenRow];

  test('Easter wins over a row with the same window', () => {
    expect(activeThemeFor(rows, { day: 5, month: 4, year: 2026 })).toBe(
      'easter'
    );
  });

  test('returns the containing row’s theme', () => {
    expect(activeThemeFor(rows, { day: 31, month: 10, year: 2026 })).toBe(
      'halloween'
    );
  });

  test('returns null when nothing is in season', () => {
    expect(activeThemeFor(rows, { day: 15, month: 7, year: 2026 })).toBeNull();
    expect(activeThemeFor([], { day: 15, month: 7, year: 2026 })).toBeNull();
  });

  // The API rejects overlapping rows, but a hand-edited one can still overlap:
  // the answer is "the first match in the order the caller supplied", which is
  // what makes the served skin deterministic instead of luck-of-the-scan.
  test('returns the first matching row when two contain today', () => {
    const christmas = { ...window(12, 1, 12, 31), theme: 'christmas' };
    const spooky = { ...window(12, 24, 12, 26), theme: 'halloween' };
    const today = { day: 25, month: 12, year: 2026 };

    expect(activeThemeFor([christmas, spooky], today)).toBe('christmas');
    expect(activeThemeFor([spooky, christmas], today)).toBe('halloween');
  });
});

describe('todayInTimeZone', () => {
  test('reads the wall-clock day of the zone, not the instant’s UTC day', () => {
    // 23:30 UTC on 31 December is already 00:30 on 1 January in Budapest.
    const instant = new Date('2026-12-31T23:30:00Z');

    expect(todayInTimeZone(instant, 'Europe/Budapest')).toEqual({
      day: 1,
      month: 1,
      year: 2027,
    });
    expect(todayInTimeZone(instant, 'America/New_York')).toEqual({
      day: 31,
      month: 12,
      year: 2026,
    });
  });
});

describe('resolveTheme', () => {
  const easterRow = { ...window(3, 29, 4, 6), theme: 'summer' };
  const halloween = { ...window(10, 25, 11, 2), theme: 'halloween' };

  test('Easter beats a row that contains today', () => {
    expect(
      resolveTheme('christmas', [easterRow], {
        day: 31,
        month: 3,
        year: 2026,
      })
    ).toEqual({ source: 'schedule', theme: 'easter' });
  });

  test('a containing row beats the stored theme', () => {
    expect(
      resolveTheme('christmas', [halloween], {
        day: 31,
        month: 10,
        year: 2026,
      })
    ).toEqual({ source: 'schedule', theme: 'halloween' });
  });

  test('no match returns the stored theme as manual', () => {
    expect(
      resolveTheme('christmas', [halloween], {
        day: 15,
        month: 7,
        year: 2026,
      })
    ).toEqual({ source: 'manual', theme: 'christmas' });
  });

  test('a row naming the stored theme still reports the schedule', () => {
    expect(
      resolveTheme('halloween', [halloween], {
        day: 31,
        month: 10,
        year: 2026,
      })
    ).toEqual({ source: 'schedule', theme: 'halloween' });
  });
});

describe('isRealMonthDay', () => {
  test('accepts days every year has', () => {
    expect(isRealMonthDay(1, 31)).toBe(true);
    expect(isRealMonthDay(2, 28)).toBe(true);
    expect(isRealMonthDay(12, 31)).toBe(true);
  });

  test('rejects 29 February, which an annual window cannot mean', () => {
    expect(isRealMonthDay(2, 29)).toBe(false);
  });

  test('rejects impossible days', () => {
    expect(isRealMonthDay(2, 30)).toBe(false);
    expect(isRealMonthDay(4, 31)).toBe(false);
    expect(isRealMonthDay(13, 1)).toBe(false);
    expect(isRealMonthDay(1, 0)).toBe(false);
  });
});
