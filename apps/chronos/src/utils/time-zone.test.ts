import { describe, expect, it } from 'bun:test';

import {
  formatDateInTimeZone,
  getWeekdayInTimeZone,
  isTimeZone,
  offsetMinutesAt,
} from '@/utils/time-zone';

const BUDAPEST = 'Europe/Budapest';

describe('offsetMinutesAt', () => {
  it('reports the winter offset (UTC+1)', () => {
    const date = new Date('2026-01-15T12:00:00Z');
    expect(offsetMinutesAt(date, BUDAPEST)).toBe(60);
    expect(formatDateInTimeZone(date, BUDAPEST)).toBe('2026-01-15');
  });

  it('reports the summer offset (UTC+2)', () => {
    const date = new Date('2026-07-15T12:00:00Z');
    expect(offsetMinutesAt(date, BUDAPEST)).toBe(120);
    expect(formatDateInTimeZone(date, BUDAPEST)).toBe('2026-07-15');
  });

  it('switches offset at the spring DST instant', () => {
    expect(offsetMinutesAt(new Date('2026-03-29T00:30:00Z'), BUDAPEST)).toBe(
      60
    );
    expect(offsetMinutesAt(new Date('2026-03-29T01:30:00Z'), BUDAPEST)).toBe(
      120
    );
  });

  it('switches offset at the autumn DST instant', () => {
    expect(offsetMinutesAt(new Date('2026-10-25T00:30:00Z'), BUDAPEST)).toBe(
      120
    );
    expect(offsetMinutesAt(new Date('2026-10-25T01:30:00Z'), BUDAPEST)).toBe(
      60
    );
  });

  it('handles a non-whole-hour offset', () => {
    expect(
      offsetMinutesAt(new Date('2026-01-15T12:00:00Z'), 'Asia/Kathmandu')
    ).toBe(345);
  });

  it('returns 0, not -0, for a zero-offset zone', () => {
    const offset = offsetMinutesAt(new Date('2026-01-15T12:00:00.123Z'), 'UTC');
    expect(offset).toBe(0);
    expect(Object.is(offset, -0)).toBe(false);
  });
});

describe('formatDateInTimeZone', () => {
  it('diverges from the UTC date after midnight in Budapest', () => {
    const instant = new Date('2026-11-10T23:30:00Z');
    expect(formatDateInTimeZone(instant, BUDAPEST)).toBe('2026-11-11');
    expect(formatDateInTimeZone(instant, 'UTC')).toBe('2026-11-10');
  });
});

describe('getWeekdayInTimeZone', () => {
  it('returns the weekday index (0 = Sunday … 6 = Saturday)', () => {
    // 2026-11-10 is a Tuesday.
    expect(
      getWeekdayInTimeZone(new Date('2026-11-10T12:00:00Z'), BUDAPEST)
    ).toBe(2);
  });

  it('agrees with the date across the midnight boundary', () => {
    // 23:30Z is already Wednesday in Budapest, matching formatDateInTimeZone.
    const instant = new Date('2026-11-10T23:30:00Z');
    expect(formatDateInTimeZone(instant, BUDAPEST)).toBe('2026-11-11');
    expect(getWeekdayInTimeZone(instant, BUDAPEST)).toBe(3);
  });
});

describe('isTimeZone', () => {
  it('accepts a valid IANA zone', () => {
    expect(isTimeZone(BUDAPEST)).toBe(true);
  });

  it('rejects an unknown zone and an empty string', () => {
    expect(isTimeZone('Not/AZone')).toBe(false);
    expect(isTimeZone('')).toBe(false);
  });
});
