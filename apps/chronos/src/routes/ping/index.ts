import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { pingFactory } from '#routes/ping/_router';
import { ensureJsonSafeDates } from '#utils/zod';

const pingResponseSchema = z.object({
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
            schema: resolver(ensureJsonSafeDates(pingResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Ping'],
  }),
  (c) =>
    c.json<SuccessResponse<{ message: 'pong' }>>({
      data: { message: 'pong' },
      success: true,
    })
);
