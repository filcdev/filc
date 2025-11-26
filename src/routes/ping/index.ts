import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import { pingFactory } from '~/routes/ping/_factory';
import type { SuccessResponse } from '~/utils/globals';
import { ensureJsonSafeDates } from '~/utils/zod';

const PingResponseSchema = z.object({
  data: z.object({
    message: z.string(),
  }),
  success: z.boolean(),
});

export const ping = pingFactory.createHandlers(
  describeRoute({
    description: 'Health check endpoint that returns a pong response.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(PingResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Ping'],
  }),
  (c) =>
    c.json<SuccessResponse>({
      data: { message: 'pong' },
      success: true,
    })
);
