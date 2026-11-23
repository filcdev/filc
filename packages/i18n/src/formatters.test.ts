import { describe, expect, test } from 'bun:test';
import {
  formatMailDate,
  formatMailDateWithWeekday,
  periodLabel,
  WEEKDAY_NAMES_EN,
  WEEKDAY_NAMES_HU,
  weekdayOn,
} from './formatters';

// A Tuesday, built from local date parts so `getDay()` agrees in any timezone.
const date = new Date(2026, 10, 17);

describe('formatMailDate', () => {
  test('English is ISO-shaped', () => {
    expect(formatMailDate(date, 'en')).toBe('2026-11-17');
    expect(formatMailDate(new Date(2026, 0, 5), 'en')).toBe('2026-01-05');
  });

  test('Hungarian is dotted', () => {
    expect(formatMailDate(date, 'hu')).toBe('2026. 11. 17.');
    expect(formatMailDate(new Date(2026, 0, 5), 'hu')).toBe('2026. 01. 05.');
  });
});

describe('formatMailDateWithWeekday', () => {
  test('prefixes the weekday name', () => {
    expect(formatMailDateWithWeekday(date, 'en')).toBe('Tuesday, 2026-11-17');
    expect(formatMailDateWithWeekday(date, 'hu')).toBe('Kedd, 2026. 11. 17.');
  });

  test('uses a Sunday-first table, like Date#getDay', () => {
    expect(WEEKDAY_NAMES_EN[0]).toBe('Sunday');
    expect(WEEKDAY_NAMES_HU[0]).toBe('Vasárnap');
    expect(WEEKDAY_NAMES_EN[2]).toBe('Tuesday');
  });
});

describe('periodLabel', () => {
  test('accepts a number or a string period', () => {
    expect(periodLabel(3, 'en')).toBe('Period 3');
    expect(periodLabel('3', 'en')).toBe('Period 3');
    expect(periodLabel(3, 'hu')).toBe('3. óra');
    expect(periodLabel('3', 'hu')).toBe('3. óra');
  });
});

describe('weekdayOn', () => {
  test('English keeps the plain name', () => {
    expect(weekdayOn(2, 'en')).toBe('Tuesday');
    expect(weekdayOn(3, 'en')).toBe('Wednesday');
  });

  test('Hungarian uses the inflected form', () => {
    expect(weekdayOn(0, 'hu')).toBe('vasárnap');
    expect(weekdayOn(1, 'hu')).toBe('hétfőn');
    expect(weekdayOn(2, 'hu')).toBe('kedden');
    expect(weekdayOn(3, 'hu')).toBe('szerdán');
    expect(weekdayOn(4, 'hu')).toBe('csütörtökön');
    expect(weekdayOn(5, 'hu')).toBe('pénteken');
    expect(weekdayOn(6, 'hu')).toBe('szombaton');
  });
});
