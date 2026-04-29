import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { cohort, timetable } from '#database/schema/timetable';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';
import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { timetableFactory } from './_factory';

const logger = getLogger(['chronos', 'cohort']);

const getForTimetableResponseSchema = z.object({
  data: createSelectSchema(cohort).array(),
  success: z.boolean(),
});

export const getCohortsForTimetable = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Cohort', '@listof Cohort', true),
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
            schema: resolver(getForTimetableResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Cohort'],
  }),
  zValidator('param', z.object({ timetableId: z.uuid() })),
  async (c) => {
    try {
      const { timetableId } = c.req.valid('param');

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
