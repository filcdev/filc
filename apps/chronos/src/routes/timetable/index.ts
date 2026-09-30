import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { and, count, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import {
  cohort,
  cohortTimetableMtm,
  lesson,
  movedLesson,
  movedLessonLessonMTM,
  substitution,
  substitutionLessonMTM,
  timetable,
} from '#database/schema/timetable';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { badRequest, notFound } from '#utils/http';
import { dispatchImmediateNotification } from '#utils/notifications/engine';
import { getActiveTimetableId } from '#utils/timetable/active';
import { cleanupOrphanedCohorts } from '#utils/timetable/cleanup';
import { dateToYYYYMMDD } from '#utils/timetable/date';
import { remapSubstitutionLessonsToTimetable } from '#utils/timetable/remap-substitutions';

export const getAllTimetables = base.timetable.timetables.list.handler(
  async () => {
    const timetables = await db.select().from(timetable);

    return timetables;
  }
);

export const getLatestValidTimetable =
  base.timetable.timetables.latestValid.handler(async () => {
    const activeId = await getActiveTimetableId();
    if (!activeId) {
      throw notFound('No valid timetable found.');
    }

    const [latestValidTimetable] = await db
      .select()
      .from(timetable)
      .where(eq(timetable.id, activeId))
      .limit(1);

    if (!latestValidTimetable) {
      throw notFound('No valid timetable found.');
    }

    return latestValidTimetable;
  });

export const getAllValidTimetables = base.timetable.timetables.valid.handler(
  async () => {
    const today = dateToYYYYMMDD(new Date());

    const timetables = await db
      .select()
      .from(timetable)
      .where(
        and(
          lte(timetable.validFrom, today),
          or(isNull(timetable.validTo), gte(timetable.validTo, today))
        )
      );

    return timetables;
  }
);

export const updateTimetable = base.timetable.timetables.update
  .use(requireAuthorization(permissions.importTimetable))
  .handler(async ({ input }) => {
    const { id, ...body } = input;

    const [existing] = await db
      .select()
      .from(timetable)
      .where(eq(timetable.id, id))
      .limit(1);

    if (!existing) {
      throw notFound('Timetable not found');
    }

    const [updated] = await db
      .update(timetable)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.validFrom !== undefined && { validFrom: body.validFrom }),
        ...(body.validTo !== undefined && { validTo: body.validTo }),
      })
      .where(eq(timetable.id, id))
      .returning();

    if (!updated) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to update timetable',
      });
    }

    return updated;
  });

export const deleteTimetable = base.timetable.timetables.delete
  .use(requireAuthorization(permissions.importTimetable))
  .handler(async ({ input }) => {
    const { id } = input;

    const [existing] = await db
      .select()
      .from(timetable)
      .where(eq(timetable.id, id))
      .limit(1);

    if (!existing) {
      throw notFound('Timetable not found');
    }

    const activeId = await getActiveTimetableId();

    if (activeId === id) {
      throw badRequest('Cannot delete the currently active timetable.');
    }

    const notifiedUserIds: string[] = [];

    await db.transaction(async (tx) => {
      // Re-link substitutions to equivalent lessons in the active timetable
      // before deleting the old timetable.
      if (activeId) {
        const remapResult = await remapSubstitutionLessonsToTimetable(
          tx,
          id,
          activeId
        );

        if (remapResult.unmatchedSourceLessonIds.length > 0) {
          throw badRequest(
            `Cannot delete timetable: ${remapResult.unmatchedSourceLessonIds.length} substituted lesson(s) ` +
              'could not be uniquely matched to the active timetable.'
          );
        }
      } else {
        const [linkedSubstitution] = await tx
          .select({
            substitutionId: substitutionLessonMTM.substitutionId,
          })
          .from(substitutionLessonMTM)
          .innerJoin(lesson, eq(substitutionLessonMTM.lessonId, lesson.id))
          .where(eq(lesson.timetableId, id))
          .limit(1);

        if (linkedSubstitution) {
          throw badRequest(
            'Cannot delete timetable with substitutions because there is no active timetable to migrate them to.'
          );
        }
      }

      // Find cohorts in other timetables (will survive deletion)
      const survivingRows = await tx
        .selectDistinct({ cohortId: cohortTimetableMtm.cohortId })
        .from(cohortTimetableMtm)
        .where(ne(cohortTimetableMtm.timetableId, id));

      const survivingSet = new Set(survivingRows.map((row) => row.cohortId));

      // Cohorts linked only to this timetable become orphaned after deletion
      const timetableCohortRows = await tx
        .select({ cohortId: cohortTimetableMtm.cohortId })
        .from(cohortTimetableMtm)
        .where(eq(cohortTimetableMtm.timetableId, id));

      const orphanedCohortIds = timetableCohortRows
        .map((row) => row.cohortId)
        .filter((cohortId) => !survivingSet.has(cohortId));

      if (orphanedCohortIds.length > 0) {
        // Nullify cohortId on users referencing orphaned cohorts.
        const updatedUsers = await tx
          .update(user)
          .set({ cohortId: null })
          .where(inArray(user.cohortId, orphanedCohortIds))
          .returning({ id: user.id });

        if (updatedUsers.length > 0) {
          notifiedUserIds.push(...updatedUsers.map((u) => u.id));
        }

        // Delete cohorts that are no longer linked to any timetable.
        await tx.delete(cohort).where(inArray(cohort.id, orphanedCohortIds));
      }

      // Finally delete the timetable.
      await tx.delete(timetable).where(eq(timetable.id, id));
    });

    for (const userId of notifiedUserIds) {
      dispatchImmediateNotification('cohort_reselection_required', { userId });
    }

    return { id };
  });

export const previewDeleteTimetable = base.timetable.timetables.previewDelete
  .use(requireAuthorization(permissions.importTimetable))
  .handler(async ({ input }) => {
    const { id } = input;

    const [existing] = await db
      .select()
      .from(timetable)
      .where(eq(timetable.id, id))
      .limit(1);

    if (!existing) {
      throw notFound('Timetable not found');
    }

    const activeId = await getActiveTimetableId();
    const isCurrentTimetable = activeId === id;

    // Fetch the active timetable's name in one query (it's the fallback target)
    let targetTimetable: { id: string; name: string } | null = null;
    if (activeId && activeId !== id) {
      const [activeTimetable] = await db
        .select({ id: timetable.id, name: timetable.name })
        .from(timetable)
        .where(eq(timetable.id, activeId))
        .limit(1);
      targetTimetable = activeTimetable ?? null;
    }

    // Cohorts linked to this timetable
    const timetableCohorts = await db
      .select({ id: cohort.id, name: cohort.name })
      .from(cohort)
      .innerJoin(cohortTimetableMtm, eq(cohort.id, cohortTimetableMtm.cohortId))
      .where(eq(cohortTimetableMtm.timetableId, id));

    // Single query: which of those cohorts also exist in other timetables
    let cohortResults: Array<{
      becomesOrphaned: boolean;
      id: string;
      name: string;
    }> = [];
    if (timetableCohorts.length > 0) {
      const cohortIds = timetableCohorts.map((row) => row.id);
      const survivingRows = await db
        .selectDistinct({ cohortId: cohortTimetableMtm.cohortId })
        .from(cohortTimetableMtm)
        .where(
          and(
            inArray(cohortTimetableMtm.cohortId, cohortIds),
            ne(cohortTimetableMtm.timetableId, id)
          )
        );
      const survivingSet = new Set(survivingRows.map((r) => r.cohortId));
      cohortResults = timetableCohorts.map((row) => ({
        becomesOrphaned: !survivingSet.has(row.id),
        id: row.id,
        name: row.name,
      }));
    }

    const orphanedCount = cohortResults.filter(
      (item) => item.becomesOrphaned
    ).length;

    // Count users whose cohort will be orphaned by this deletion
    const orphanedCohortIds = cohortResults
      .filter((item) => item.becomesOrphaned)
      .map((item) => item.id);
    let affectedUserCount = 0;
    if (orphanedCohortIds.length > 0) {
      const [affectedCount] = await db
        .select({ count: count() })
        .from(user)
        .where(inArray(user.cohortId, orphanedCohortIds));
      affectedUserCount = affectedCount?.count ?? 0;
    }

    const [lessonCount] = await db
      .select({ count: count() })
      .from(lesson)
      .where(eq(lesson.timetableId, id));

    const movedLessonRows = await db
      .select({ id: movedLesson.id })
      .from(movedLesson)
      .innerJoin(
        movedLessonLessonMTM,
        eq(movedLesson.id, movedLessonLessonMTM.movedLessonId)
      )
      .innerJoin(lesson, eq(movedLessonLessonMTM.lessonId, lesson.id))
      .where(eq(lesson.timetableId, id));
    const movedLessonIds = [...new Set(movedLessonRows.map((r) => r.id))];

    const substitutionRows = await db
      .select({ id: substitution.id })
      .from(substitution)
      .innerJoin(
        substitutionLessonMTM,
        eq(substitution.id, substitutionLessonMTM.substitutionId)
      )
      .innerJoin(lesson, eq(substitutionLessonMTM.lessonId, lesson.id))
      .where(eq(lesson.timetableId, id));
    const substitutionIds = [...new Set(substitutionRows.map((r) => r.id))];

    return {
      cohorts: cohortResults,
      isCurrentTimetable,
      targetTimetable,
      totals: {
        danglingUsersCleaned: affectedUserCount,
        lessonsDeleted: lessonCount?.count ?? 0,
        movedLessonsDeleted: movedLessonIds.length,
        orphanedCohorts: orphanedCount,
        substitutionsDeleted: substitutionIds.length,
        survivingCohorts: cohortResults.length - orphanedCount,
      },
    };
  });

export const cleanupOrphanedCohortsHandler =
  base.timetable.timetables.cleanupOrphanedCohorts
    .use(requireAuthorization(permissions.importTimetable))
    .handler(async () => {
      const result = await cleanupOrphanedCohorts();

      return result;
    });
