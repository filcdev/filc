import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-zod';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { cohort, timetable } from '#database/schema/timetable';
import { requireAuthentication } from '#middleware/auth';
import { ensureJsonSafeDates } from '#utils/zod';
import { timetableFactory } from './_router';

const logger = getLogger(['chronos', 'cohort']);

const getForTimetableResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(cohort)).array(),
  success: z.boolean(),
});

export const getCohortsForTimetable = timetableFactory.createHandlers(
  describeRoute({
    description: 'Get cohorts for a given timetable from the database.',
    parameters: [
      {
        in: 'path',
        name: 'timetableId',
        required: true,
        schema: {
          description: 'The unique identifier for the timetable.',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(
              ensureJsonSafeDates(getForTimetableResponseSchema)
            ),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Cohort'],
  }),
  requireAuthentication,
  async (c) => {
    try {
      const timetableId = c.req.param('timetableId');

      if (!timetableId) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: 'Missing timetableId parameter.',
        });
      }

      const cohorts = await db
        .select()
        .from(cohort)
        .leftJoin(timetable, eq(cohort.timetableId, timetable.id))
        .where(eq(timetable.id, timetableId));

      return c.json<SuccessResponse<typeof cohorts>>({
        data: cohorts,
        success: true,
      });
    } catch (error) {
      logger.error('Error fetching cohorts for timetable', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to fetch all cohorts for timetable.',
      });
    }
  }
);
