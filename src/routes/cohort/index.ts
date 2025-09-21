import { db } from '~/database';
import { cohort } from '~/database/schema/timetable';
import { pingFactory } from '~/routes/ping/_factory';
import type { SuccessResponse } from '~/utils/globals';

export const listCohorts = pingFactory.createHandlers(async (c) => {
  const cohorts = await db.select().from(cohort);

  return c.json<SuccessResponse>({
    success: true,
    data: cohorts,
  });
});
