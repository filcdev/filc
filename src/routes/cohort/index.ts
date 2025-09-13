import { db } from '~/database';
import { cohort } from '~/database/schema/timetable';
import { pingFactory } from '~/routes/ping/_factory';

export const listCohorts = pingFactory.createHandlers(async (c) => {
  const cohorts = await db.select().from(cohort);

  return c.json(cohorts);
});
