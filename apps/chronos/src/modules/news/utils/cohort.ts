import { type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
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

/**
 * The condition restricting a cohort-targeted row to what a viewer may see.
 *
 * A row with no cohort links is global; a targeted row only matches its own
 * cohorts. A viewer without a cohort therefore sees global rows only — the
 * `else` branch is the whole point, and omitting it leaks every targeted row to
 * every cohort-less viewer.
 *
 * Shared rather than written per caller: announcements and system messages each
 * had their own copy, and they had already drifted into disagreeing about that
 * branch.
 */
export const cohortVisibilityCondition = (
  linkTable: PgTable,
  ownerColumn: AnyPgColumn,
  ownerId: AnyPgColumn | SQL,
  cohortColumn: AnyPgColumn,
  viewerCohortId: string | null | undefined
): SQL => {
  const untargeted = sql`NOT EXISTS (SELECT 1 FROM ${linkTable} WHERE ${ownerColumn} = ${ownerId})`;

  if (!viewerCohortId) {
    return untargeted;
  }

  return sql`(
    ${untargeted}
    OR EXISTS (SELECT 1 FROM ${linkTable} WHERE ${ownerColumn} = ${ownerId} AND ${cohortColumn} = ${viewerCohortId})
  )`;
};
