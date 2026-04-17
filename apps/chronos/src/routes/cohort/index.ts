import { createSelectSchema } from 'drizzle-zod';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import { db } from '#database';
import { cohort } from '#database/schema/timetable';
import { cohortFactory } from '#routes/cohort/_factory';
import type { SuccessResponse } from '#utils/globals';
import { filcExt } from '#utils/openapi';
import { ensureJsonSafeDates } from '#utils/zod';

const cohortResponseSchema = z.object({
  data: z.array(ensureJsonSafeDates(createSelectSchema(cohort))),
  success: z.boolean(),
});

export const listCohorts = cohortFactory.createHandlers(
  describeRoute({
    ...filcExt('Cohort', '@listof Cohort'),
    description: 'List all cohorts.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(cohortResponseSchema),
          },
        },
        description: 'Successful Response',
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
