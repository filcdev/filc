import { describe, expect, test } from 'bun:test';
import {
  activeThemeFor,
  easterSunday,
  easterWindowContains,
  isRealMonthDay,
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
});

describe('isRealMonthDay', () => {
  test('accepts real days, including 29 February', () => {
    expect(isRealMonthDay(1, 31)).toBe(true);
    expect(isRealMonthDay(2, 29)).toBe(true);
    expect(isRealMonthDay(12, 31)).toBe(true);
  });

  test('rejects impossible days', () => {
    expect(isRealMonthDay(2, 30)).toBe(false);
    expect(isRealMonthDay(4, 31)).toBe(false);
    expect(isRealMonthDay(13, 1)).toBe(false);
    expect(isRealMonthDay(1, 0)).toBe(false);
  });
});
