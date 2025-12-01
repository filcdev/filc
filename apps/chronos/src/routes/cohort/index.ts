import { db } from '@/database';
import { cohort } from '@/database/schema/timetable';
import { cohortFactory } from '@/routes/cohort/_factory';
import type { SuccessResponse } from '@/utils/globals';

export const listCohorts = cohortFactory.createHandlers(async (c) => {
  const cohorts = await db.select().from(cohort);

  return c.json<SuccessResponse<typeof cohorts>>({
    data: cohorts,
    success: true,
  });
});
