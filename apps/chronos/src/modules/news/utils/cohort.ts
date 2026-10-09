import { sql } from 'drizzle-orm';
import { db } from '#database';
import { cohort } from '#modules/timetable/schema';
import { badRequest } from '#utils/http';

/** Throw 400 if any of the provided cohort IDs do not exist. */
export const validateCohortIds = async (cohortIds: string[]) => {
  const existingCohorts = await db
    .select({ id: cohort.id })
    .from(cohort)
    .where(sql`${cohort.id} IN ${cohortIds}`);
  const existingIds = new Set(existingCohorts.map((co) => co.id));
  const invalid = cohortIds.filter((cid) => !existingIds.has(cid));
  if (invalid.length > 0) {
    throw badRequest(`Invalid cohort IDs: ${invalid.join(', ')}`);
  }
};
