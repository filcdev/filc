import { getLogger } from '@logtape/logtape';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { formatDateInTimeZone, offsetMinutesAt } from '#utils/time-zone';

const logger = getLogger(['chronos', 'ping', 'time']);

export const time = base.ping.time.handler(({ context }) => {
  const now = new Date();
  const date = formatDateInTimeZone(now, env.timeZone);
  const offset = offsetMinutesAt(now, env.timeZone);

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
