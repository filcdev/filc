import { getLogger } from '@logtape/logtape';
import { asc, inArray } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import {
  cohort,
  cohortGroup,
  cohortTimetableMtm,
  lesson,
  substitution,
  teacher,
} from '#database/schema/timetable';

const logger = getLogger(['chronos', 'timetable', 'cleanup']);

export type CleanupOrphanedCohortsResult = {
  affectedUserCount: number;
  deletedCohortIds: string[];
  deletedTeacherIds: string[];
};

/**
 * Find and delete cohorts that are not linked to any timetable via the
 * `cohort_timetable_mtm` table, plus teachers that are not assigned to any
 * lesson.  For each orphaned cohort, any user referencing that cohort has
 * their `cohortId` set to NULL before the cohort row is removed.
 *
 * A teacher counts as "assigned" if its id appears in any `lesson.teacherIds`
 * array (a text-array column with no FK/index), or if it is referenced by a
 * NO-ACTION foreign key from `substitution.substituter`, `cohort.teacherId`,
 * or `cohortGroup.teacherId`.  Teachers referenced by any of those FKs are
 * kept, since deleting them would violate the FK constraint.
 *
 * The destructive part of the operation (user nullification + cohort/teacher
 * deletion) runs inside a single database transaction.  Cohort rows are locked
 * with `FOR UPDATE` before computing the orphan set to prevent a race where a
 * concurrent insert into `cohort_timetable_mtm` would be cascade-deleted.
 */
export async function cleanupOrphanedCohorts(): Promise<CleanupOrphanedCohortsResult> {
  let affectedUserCount = 0;
  let deletedCohortIds: string[] = [];
  let deletedTeacherIds: string[] = [];

  await db.transaction(async (tx) => {
    // Lock all cohort rows to prevent concurrent MTM inserts that would
    // create a race between computing orphans and deleting them.
    const allCohortRows = await tx
      .select({ id: cohort.id })
      .from(cohort)
      .for('update');

    // Find all cohort IDs that are referenced in the MTM table
    const linkedRows = await tx
      .selectDistinct({ cohortId: cohortTimetableMtm.cohortId })
      .from(cohortTimetableMtm);

    const linkedSet = new Set(linkedRows.map((r) => r.cohortId));

    // Cohorts whose ID does not appear in the MTM table are orphaned
    const orphanedCohortIds = allCohortRows
      .map((r) => r.id)
      .filter((id) => !linkedSet.has(id));

    if (orphanedCohortIds.length === 0) {
      logger.info('No orphaned cohorts found.');
    } else {
      logger.info('Found orphaned cohorts', {
        count: orphanedCohortIds.length,
      });

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
      deletedCohortIds = orphanedCohortIds;
      logger.info('Deleted orphaned cohorts', {
        count: orphanedCohortIds.length,
      });
    }

    // Lock all teacher rows in ascending id order so a concurrent insert
    // can't race the orphan scan. Ordering matches the sorted lock order used
    // by the substitution writer, avoiding a deadlock where the two
    // transactions acquire teacher locks in opposite orders.
    const allTeacherRows = await tx
      .select({ id: teacher.id })
      .from(teacher)
      .orderBy(asc(teacher.id))
      .for('update');

    // Teachers referenced by any lesson's `teacherIds` array are assigned.
    const lessonRows = await tx
      .select({ teacherIds: lesson.teacherIds })
      .from(lesson);
    const usedTeacherIds = new Set(
      lessonRows.flatMap((r) => r.teacherIds ?? []).filter((id) => id !== null)
    );

    // Teachers referenced by NO-ACTION FKs must be kept.
    const [substitutionRows, cohortRows, cohortGroupRows] = await Promise.all([
      tx
        .selectDistinct({ substituter: substitution.substituter })
        .from(substitution),
      tx.selectDistinct({ teacherId: cohort.teacherId }).from(cohort),
      tx.selectDistinct({ teacherId: cohortGroup.teacherId }).from(cohortGroup),
    ]);
    const referencedTeacherIds = new Set([
      ...substitutionRows.map((r) => r.substituter).filter((id) => id !== null),
      ...cohortRows.map((r) => r.teacherId).filter((id) => id !== null),
      ...cohortGroupRows.map((r) => r.teacherId).filter((id) => id !== null),
    ]);

    const orphanedTeacherIds = allTeacherRows
      .map((r) => r.id)
      .filter(
        (id) => !(usedTeacherIds.has(id) || referencedTeacherIds.has(id))
      );

    if (orphanedTeacherIds.length === 0) {
      logger.info('No unlinked teachers found.');
    } else {
      await tx.delete(teacher).where(inArray(teacher.id, orphanedTeacherIds));
      deletedTeacherIds = orphanedTeacherIds;
      logger.info('Deleted unlinked teachers', {
        count: orphanedTeacherIds.length,
      });
    }
  });

  return { affectedUserCount, deletedCohortIds, deletedTeacherIds };
}
