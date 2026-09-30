import { db } from '#database';
import { cohort } from '#database/schema/timetable';
import { base } from '#orpc';

export const listCohorts = base.cohort.cohort.handler(async () => {
  const cohorts = await db.select().from(cohort);

  return cohorts;
});
