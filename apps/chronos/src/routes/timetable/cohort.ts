import { eq } from 'drizzle-orm';
import { db } from '#database';
import { cohort, cohortTimetableMtm } from '#database/schema/timetable';
import { base } from '#orpc';

export const getCohortsForTimetable =
  base.timetable.cohorts.getAllForTimetable.handler(async ({ input }) => {
    const { timetableId } = input;

    const cohortRows = await db
      .select()
      .from(cohort)
      .innerJoin(cohortTimetableMtm, eq(cohort.id, cohortTimetableMtm.cohortId))
      .where(eq(cohortTimetableMtm.timetableId, timetableId));

    const cohorts = cohortRows.map((r) => r.cohort);

    return cohorts;
  });
