import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { base } from '#orpc';

dayjs.extend(relativeTime);
dayjs.extend(duration);

export const uptime = base.ping.uptime.handler(() => {
  const NANOSECONDS_IN_MILLISECOND = 1_000_000;
  const uptime_ms = Bun.nanoseconds() / NANOSECONDS_IN_MILLISECOND;

  return {
    pretty: dayjs.duration(uptime_ms, 'millisecond').humanize(),
    uptime_ms,
  };
});
