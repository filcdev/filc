import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import { pingFactory } from '#routes/ping/_factory';
import { ok } from '#utils/http';
import { filcExt } from '#utils/openapi';

dayjs.extend(relativeTime);
dayjs.extend(duration);

const uptimeResponseSchema = z.object({
  data: z.object({
    pretty: z.string(),
    uptime_ms: z.number(),
  }),
  success: z.boolean(),
});

export const uptime = pingFactory.createHandlers(
  describeRoute({
    ...filcExt('Ping', '@unit UptimeResponse'),
    description: 'Get the uptime.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(uptimeResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Ping'],
  }),
  (c) => {
    const NANOSECONDS_IN_MILLISECOND = 1_000_000;
    const uptime_ms = Bun.nanoseconds() / NANOSECONDS_IN_MILLISECOND;

    return ok(c, {
      pretty: dayjs.duration(uptime_ms, 'millisecond').humanize(),
      uptime_ms,
    });
  }
);
