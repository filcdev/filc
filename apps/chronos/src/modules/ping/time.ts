import { getLogger } from '@logtape/logtape';
import { base } from '#orpc';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'ping', 'time']);

// `hourCycle: 'h23'` is required: without it some locales render midnight as `24`.
const partsFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: env.timeZone,
  year: 'numeric',
});

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: env.timeZone,
  year: 'numeric',
});

/** UTC offset of the configured zone at `now`, in minutes. */
const offsetMinutes = (now: Date): number => {
  const parts = partsFormatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  // The configured zone's wall clock, reinterpreted as if it were UTC.
  const wallClockAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second')
  );

  // `|| 0` normalises the `-0` this yields for a zero-offset zone (e.g. UTC)
  // whenever `now` carries milliseconds, so the response never serialises `-0`.
  return Math.round((wallClockAsUtc - now.getTime()) / 60_000) || 0;
};

export const time = base.ping.time.handler(({ context }) => {
  const now = new Date();
  const date = dateFormatter.format(now);
  const offset = offsetMinutes(now);

  logger.debug('server time read', {
    date,
    offsetMinutes: offset,
    requestId: context.requestId,
  });

  return {
    date,
    iso: now.toISOString(),
    offsetMinutes: offset,
    timeZone: env.timeZone,
    unixMs: now.getTime(),
  };
});
