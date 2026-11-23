import { describe, expect, it } from 'bun:test';
import {
  cutoffLiteral,
  formatDateInTimeZone,
  getWeekdayInTimeZone,
  getZonedDateTimeParts,
  isTimeZone,
  offsetMinutesAt,
  startOfDayInTimeZone,
} from '#utils/time-zone';

const BUDAPEST = 'Europe/Budapest';

/** `HH:MM:SS` of `instant` on the zone's wall clock. */
const localTime = (instant: Date, timeZone: string): string => {
  const { hour, minute, second } = getZonedDateTimeParts(instant, timeZone);
  return `${hour}:${minute}:${second}`;
};

/** The UTC instant a `YYYY-MM-DD HH:MM:SS` literal names. */
const instantOf = (literal: string): Date => new Date(`${literal}Z`);

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

describe('startOfDayInTimeZone', () => {
  it('returns local midnight of the same day from a midday instant', () => {
    // 12:00Z is 14:00 CEST, so the day starts at 22:00Z the previous evening.
    const start = startOfDayInTimeZone(
      new Date('2026-07-15T12:00:00Z'),
      BUDAPEST
    );
    expect(start.toISOString()).toBe('2026-07-14T22:00:00.000Z');
    expect(formatDateInTimeZone(start, BUDAPEST)).toBe('2026-07-15');
    expect(localTime(start, BUDAPEST)).toBe('00:00:00');
  });

  it('returns that day, not the previous one, just after local midnight', () => {
    // 22:30Z is already 00:30 on the 16th in Budapest.
    const start = startOfDayInTimeZone(
      new Date('2026-07-15T22:30:00Z'),
      BUDAPEST
    );
    expect(start.toISOString()).toBe('2026-07-15T22:00:00.000Z');
    expect(formatDateInTimeZone(start, BUDAPEST)).toBe('2026-07-16');
    expect(localTime(start, BUDAPEST)).toBe('00:00:00');
  });

  it('starts the spring-forward day at 00:00 CET', () => {
    // The clocks jump 02:00 → 03:00 local on 2026-03-29; midnight is still CET.
    const start = startOfDayInTimeZone(
      new Date('2026-03-29T12:00:00Z'),
      BUDAPEST
    );
    expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(offsetMinutesAt(start, BUDAPEST)).toBe(60);
    expect(formatDateInTimeZone(start, BUDAPEST)).toBe('2026-03-29');
    expect(localTime(start, BUDAPEST)).toBe('00:00:00');
  });

  it('starts the autumn-back day at 00:00 CEST', () => {
    // The clocks fall back 03:00 → 02:00 local on 2026-10-25; midnight is CEST.
    const start = startOfDayInTimeZone(
      new Date('2026-10-25T12:00:00Z'),
      BUDAPEST
    );
    expect(start.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(offsetMinutesAt(start, BUDAPEST)).toBe(120);
    expect(formatDateInTimeZone(start, BUDAPEST)).toBe('2026-10-25');
    expect(localTime(start, BUDAPEST)).toBe('00:00:00');
  });

  it('is UTC midnight for a zero-offset zone', () => {
    expect(
      startOfDayInTimeZone(
        new Date('2026-07-15T23:59:00Z'),
        'UTC'
      ).toISOString()
    ).toBe('2026-07-15T00:00:00.000Z');
  });
});

describe('cutoffLiteral', () => {
  it('renders the local start of day as a UTC `timestamp` literal', () => {
    // 22:30Z is 00:30 on the 16th in Budapest, so the day starts at 22:00Z.
    const literal = cutoffLiteral(
      new Date('2026-07-15T22:30:00.123Z'),
      BUDAPEST
    );
    expect(literal).toBe('2026-07-15 22:00:00');

    // What Postgres compares against must be local midnight, not the instant
    // passed in: parsed back as UTC it is 00:00:00 on the zone's wall clock.
    expect(localTime(instantOf(literal), BUDAPEST)).toBe('00:00:00');
    expect(formatDateInTimeZone(instantOf(literal), BUDAPEST)).toBe(
      '2026-07-16'
    );
  });

  it('keeps the literal on the local day across the spring DST change', () => {
    // 2026-03-29 is the spring-forward day; it still starts at 00:00 CET.
    const changed = cutoffLiteral(new Date('2026-03-29T10:00:00Z'), BUDAPEST);
    expect(changed).toBe('2026-03-28 23:00:00');
    expect(localTime(instantOf(changed), BUDAPEST)).toBe('00:00:00');
    expect(formatDateInTimeZone(instantOf(changed), BUDAPEST)).toBe(
      '2026-03-29'
    );

    // The day after starts at 00:00 CEST, an hour earlier on the UTC clock.
    const next = cutoffLiteral(new Date('2026-03-30T00:30:00Z'), BUDAPEST);
    expect(next).toBe('2026-03-29 22:00:00');
    expect(localTime(instantOf(next), BUDAPEST)).toBe('00:00:00');
    expect(formatDateInTimeZone(instantOf(next), BUDAPEST)).toBe('2026-03-30');
  });

  it('keeps the literal on the local day across the autumn DST change', () => {
    // 2026-10-25 is the fall-back day; it starts at 00:00 CEST.
    const changed = cutoffLiteral(new Date('2026-10-25T10:00:00Z'), BUDAPEST);
    expect(changed).toBe('2026-10-24 22:00:00');
    expect(localTime(instantOf(changed), BUDAPEST)).toBe('00:00:00');
    expect(formatDateInTimeZone(instantOf(changed), BUDAPEST)).toBe(
      '2026-10-25'
    );

    // The day after starts at 00:00 CET, an hour later on the UTC clock.
    const next = cutoffLiteral(new Date('2026-10-26T10:00:00Z'), BUDAPEST);
    expect(next).toBe('2026-10-25 23:00:00');
    expect(localTime(instantOf(next), BUDAPEST)).toBe('00:00:00');
    expect(formatDateInTimeZone(instantOf(next), BUDAPEST)).toBe('2026-10-26');
  });

  it('is UTC midnight for a zero-offset zone', () => {
    expect(cutoffLiteral(new Date('2026-07-15T23:59:00Z'), 'UTC')).toBe(
      '2026-07-15 00:00:00'
    );
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
