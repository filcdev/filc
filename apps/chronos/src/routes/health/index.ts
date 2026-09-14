import { healthResponseSchema } from '@filcdev/api/domains/health';
import { sql } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import { db } from '#database';
import { healthFactory } from '#routes/health/_factory';
import { ApiHttpError, ok } from '#utils/http';
import { filcExt } from '#utils/openapi';

export const health = healthFactory.createHandlers(
  describeRoute({
    ...filcExt('Health', '@unit HealthResponse'),
    description:
      'Readiness probe: answers 200 only when PostgreSQL is reachable.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(healthResponseSchema),
          },
        },
        description: 'Database reachable',
      },
      503: { description: 'Database unreachable' },
    },
    tags: ['Health'],
  }),
  async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
    } catch (error) {
      throw new ApiHttpError(StatusCodes.SERVICE_UNAVAILABLE, {
        cause: error,
        message: 'Database unavailable',
      });
    }
    return ok(c, { database: 'up' as const, status: 'ok' as const });
  }
);
