import { pingResponseSchema } from '@filcdev/api/domains/ping';
import { describeRoute, resolver } from 'hono-openapi';
import { pingFactory } from '#routes/ping/_factory';
import { ok } from '#utils/http';
import { filcExt } from '#utils/openapi';

export const ping = pingFactory.createHandlers(
  describeRoute({
    ...filcExt('Ping', '@unit PingResponse'),
    description: 'Health check endpoint that returns a pong response.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(pingResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Ping'],
  }),
  (c) => ok(c, { message: 'pong' as const })
);
