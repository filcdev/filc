import dayjs from 'dayjs';
import devHelper from 'dayjs/plugin/devHelper';
import duration from 'dayjs/plugin/duration';
import { pingFactory } from '~/routes/ping/_factory';

dayjs.extend(devHelper);
dayjs.extend(duration);

export const uptime = pingFactory.createHandlers((c) => {
  const NANOSECONDS_IN_MILLISECOND = 1_000_000;
  const uptime_ms = Bun.nanoseconds() / NANOSECONDS_IN_MILLISECOND;

  return c.json({
    uptime_ms,
    pretty: dayjs.duration(uptime_ms, 'millisecond').humanize(),
  });
});
