import { getLogger } from '@logtape/logtape';
import { inArray } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { cohort, cohortTimetableMtm } from '#database/schema/timetable';

const logger = getLogger(['chronos', 'timetable', 'cleanup']);

export type OrphanCleanupSummary = {
  /** IDs of the deleted cohort rows. */
  deletedCohortIds: string[];
  /** Number of users whose cohortId was nullified. */
  affectedUserCount: number;
};

/**
 * Find and delete cohorts that are not linked to any timetable via the
 * `cohort_timetable_mtm` table.  For each orphan, any user referencing that
 * cohort has their `cohortId` set to NULL before the cohort row is removed.
 *
 * The destructive part of the operation (user nullification + cohort deletion)
 * runs inside a single database transaction.
 */
export async function cleanupOrphanedCohorts(): Promise<OrphanCleanupSummary> {
  let affectedUserCount = 0;
  let deletedCohortIds: string[] = [];

  await db.transaction(async (tx) => {
    // Find all cohort IDs that are referenced in the MTM table
    const linkedRows = await tx
      .selectDistinct({ cohortId: cohortTimetableMtm.cohortId })
      .from(cohortTimetableMtm);

    const linkedSet = new Set(linkedRows.map((r) => r.cohortId));

    // Find all cohort IDs
    const allCohortRows = await tx.select({ id: cohort.id }).from(cohort);

    // Cohorts whose ID does not appear in the MTM table are orphaned
    const orphanedCohortIds = allCohortRows
      .map((r) => r.id)
      .filter((id) => !linkedSet.has(id));

    if (orphanedCohortIds.length === 0) {
      logger.info('No orphaned cohorts found.');
      return;
    }

    logger.info('Found orphaned cohorts', { count: orphanedCohortIds.length });

    // Nullify cohortId on users referencing orphaned cohorts in a single
    // conditional update to avoid a race between select and update.
    const updatedUsers = await tx
      .update(user)
      .set({ cohortId: null })
      .where(inArray(user.cohortId, orphanedCohortIds))
      .returning({ id: user.id });

    affectedUserCount = updatedUsers.length;
    if (affectedUserCount > 0) {
      logger.info('Nullified cohortId for users', {
        count: affectedUserCount,
      });
    }

    // Delete the orphaned cohort rows
    await tx.delete(cohort).where(inArray(cohort.id, orphanedCohortIds));
    logger.info('Deleted orphaned cohorts', {
      count: orphanedCohortIds.length,
    });

    deletedCohortIds = orphanedCohortIds;
  });

  return { affectedUserCount, deletedCohortIds };
}
