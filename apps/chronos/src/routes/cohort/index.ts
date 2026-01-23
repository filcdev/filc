import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { cohort } from '#database/schema/timetable';
import { cohortFactory } from '#routes/cohort/_factory';

export const listCohorts = cohortFactory.createHandlers(async (c) => {
  const cohorts = await db.select().from(cohort);

  return c.json<SuccessResponse<typeof cohorts>>({
    data: cohorts,
    success: true,
  });
});
