import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { pingFactory } from '~/routes/ping/_factory';
import type { SuccessResponse } from '~/utils/globals';

dayjs.extend(relativeTime);
dayjs.extend(duration);

export const uptime = pingFactory.createHandlers((c) => {
  const NANOSECONDS_IN_MILLISECOND = 1_000_000;
  const uptime_ms = Bun.nanoseconds() / NANOSECONDS_IN_MILLISECOND;

  return c.json<SuccessResponse>({
    data: {
      pretty: dayjs.duration(uptime_ms, 'millisecond').humanize(),
      uptime_ms,
    },
    success: true,
  });
});
