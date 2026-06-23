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
  // Find all cohort IDs that are referenced in the MTM table
  const linkedRows = await db
    .selectDistinct({ cohortId: cohortTimetableMtm.cohortId })
    .from(cohortTimetableMtm);

  const linkedSet = new Set(linkedRows.map((r) => r.cohortId));

  // Find all cohort IDs
  const allCohortRows = await db.select({ id: cohort.id }).from(cohort);

  // Cohorts whose ID does not appear in the MTM table are orphaned
  const orphanedCohortIds = allCohortRows
    .map((r) => r.id)
    .filter((id) => !linkedSet.has(id));

  if (orphanedCohortIds.length === 0) {
    logger.info('No orphaned cohorts found.');
    return { affectedUserCount: 0, deletedCohortIds: [] };
  }

  logger.info('Found orphaned cohorts', { count: orphanedCohortIds.length });

  let affectedUserCount = 0;

  await db.transaction(async (tx) => {
    // Nullify cohortId on users referencing orphaned cohorts
    const affectedUsers = await tx
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.cohortId, orphanedCohortIds));

    if (affectedUsers.length > 0) {
      const userIds = affectedUsers.map((u) => u.id);
      await tx
        .update(user)
        .set({ cohortId: null })
        .where(inArray(user.id, userIds));
      affectedUserCount = userIds.length;
      logger.info('Nullified cohortId for users', { count: userIds.length });
    }

    // Delete the orphaned cohort rows
    await tx.delete(cohort).where(inArray(cohort.id, orphanedCohortIds));
    logger.info('Deleted orphaned cohorts', {
      count: orphanedCohortIds.length,
    });
  });

  return { affectedUserCount, deletedCohortIds: orphanedCohortIds };
}
