import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { cohort } from '#database/schema/timetable';
import { cohortFactory } from '#routes/cohort/_factory';
import { createSelectSchema, ensureJsonSafeDates } from '#utils/zod';

const listCohortsResponseSchema = z.object({
  data: z.array(createSelectSchema(cohort)),
  success: z.literal(true),
});

export const listCohorts = cohortFactory.createHandlers(
  describeRoute({
    description: 'List all cohorts',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(listCohortsResponseSchema)),
          },
        },
        description: 'Successful response',
      },
    },
    tags: ['Cohort'],
  }),
  async (c) => {
    const cohorts = await db.select().from(cohort);

    return c.json<SuccessResponse<typeof cohorts>>({
      data: cohorts,
      success: true,
    });
  }
);
