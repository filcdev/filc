import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import { db } from '#database';
import { cohort, cohortTimetableMtm } from '#database/schema/timetable';
import { ok } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';
import { timetableFactory } from './_factory';

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
    const { timetableId } = c.req.valid('param');

    const cohortRows = await db
      .select()
      .from(cohort)
      .innerJoin(cohortTimetableMtm, eq(cohort.id, cohortTimetableMtm.cohortId))
      .where(eq(cohortTimetableMtm.timetableId, timetableId));

    const cohorts = cohortRows.map((r) => r.cohort);

    return ok(c, cohorts);
  }
);
