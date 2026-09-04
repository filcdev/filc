import { eq, inArray } from 'drizzle-orm';
import type { db } from '#database';
import {
  lesson,
  lessonCohortMTM,
  substitutionLessonMTM,
} from '#database/schema/timetable';

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

type LessonIdentity = {
  dayDefinitionId: string;
  groupsIds: string[] | null;
  id: string;
  periodId: string;
  periodsPerWeek: number;
  subjectId: string;
  teacherIds: string[] | null;
  termDefinitionId: string | null;
  weeksDefinitionId: string;
};

const lessonIdentitySelection = {
  dayDefinitionId: lesson.dayDefinitionId,
  groupsIds: lesson.groupsIds,
  id: lesson.id,
  periodId: lesson.periodId,
  periodsPerWeek: lesson.periodsPerWeek,
  subjectId: lesson.subjectId,
  teacherIds: lesson.teacherIds,
  termDefinitionId: lesson.termDefinitionId,
  weeksDefinitionId: lesson.weeksDefinitionId,
};

const sortedIds = (ids: string[] | null | undefined): string =>
  [...(ids ?? [])].sort().join(',');

const loadCohortIdsByLesson = async (
  tx: TxClient,
  lessonIds: string[]
): Promise<Map<string, string[]>> => {
  const result = new Map<string, string[]>();

  if (lessonIds.length === 0) {
    return result;
  }

  const rows = await tx
    .select({
      cohortId: lessonCohortMTM.cohortId,
      lessonId: lessonCohortMTM.lessonId,
    })
    .from(lessonCohortMTM)
    .where(inArray(lessonCohortMTM.lessonId, lessonIds));

  for (const row of rows) {
    const current = result.get(row.lessonId) ?? [];
    current.push(row.cohortId);
    result.set(row.lessonId, current);
  }

  return result;
};

const makeLessonIdentityKey = (
  value: LessonIdentity,
  cohortIds: string[]
): string =>
  [
    value.subjectId,
    value.dayDefinitionId,
    value.periodId,
    value.weeksDefinitionId,
    value.termDefinitionId ?? '',
    String(value.periodsPerWeek),
    sortedIds(value.teacherIds),
    sortedIds(value.groupsIds),
    sortedIds(cohortIds),
  ].join('|');

/**
 * Re-link substitutions from a timetable that is about to be deleted to
 * logically equivalent lessons in another timetable.
 *
 * Classroom ids are intentionally excluded from the identity because a room
 * change is one of the common reasons for importing a new timetable.
 *
 * If a source lesson has no unique equivalent in the target timetable, no
 * changes are made and the caller can abort the timetable deletion.
 */
export const remapSubstitutionLessonsToTimetable = async (
  tx: TxClient,
  sourceTimetableId: string,
  targetTimetableId: string
): Promise<{
  remappedLinks: number;
  unmatchedSourceLessonIds: string[];
}> => {
  const sourceLinks = await tx
    .select({
      lessonId: substitutionLessonMTM.lessonId,
      substitutionId: substitutionLessonMTM.substitutionId,
    })
    .from(substitutionLessonMTM)
    .innerJoin(lesson, eq(substitutionLessonMTM.lessonId, lesson.id))
    .where(eq(lesson.timetableId, sourceTimetableId));

  if (sourceLinks.length === 0) {
    return {
      remappedLinks: 0,
      unmatchedSourceLessonIds: [],
    };
  }

  const sourceLessonIds = [
    ...new Set(sourceLinks.map((link) => link.lessonId)),
  ];

  const [sourceLessons, targetLessons] = await Promise.all([
    tx
      .select(lessonIdentitySelection)
      .from(lesson)
      .where(inArray(lesson.id, sourceLessonIds)),
    tx
      .select(lessonIdentitySelection)
      .from(lesson)
      .where(eq(lesson.timetableId, targetTimetableId)),
  ]);

  const allLessonIds = [
    ...new Set([
      ...sourceLessons.map((item) => item.id),
      ...targetLessons.map((item) => item.id),
    ]),
  ];

  const cohortIdsByLesson = await loadCohortIdsByLesson(tx, allLessonIds);

  const targetIdsByKey = new Map<string, string[]>();

  for (const targetLesson of targetLessons) {
    const key = makeLessonIdentityKey(
      targetLesson,
      cohortIdsByLesson.get(targetLesson.id) ?? []
    );

    const current = targetIdsByKey.get(key) ?? [];
    current.push(targetLesson.id);
    targetIdsByKey.set(key, current);
  }

  const sourceById = new Map(
    sourceLessons.map((sourceLesson) => [sourceLesson.id, sourceLesson])
  );

  const targetBySourceId = new Map<string, string>();
  const unmatchedSourceLessonIds: string[] = [];

  for (const sourceLessonId of sourceLessonIds) {
    const sourceLesson = sourceById.get(sourceLessonId);

    if (!sourceLesson) {
      unmatchedSourceLessonIds.push(sourceLessonId);
      continue;
    }

    const key = makeLessonIdentityKey(
      sourceLesson,
      cohortIdsByLesson.get(sourceLesson.id) ?? []
    );

    const candidates = targetIdsByKey.get(key) ?? [];

    // We only migrate when there is exactly one unambiguous replacement.
    if (candidates.length !== 1) {
      unmatchedSourceLessonIds.push(sourceLessonId);
      continue;
    }

    const targetLessonId = candidates[0];

    if (targetLessonId) {
      targetBySourceId.set(sourceLessonId, targetLessonId);
    }
  }

  // Do not partially migrate. The caller should abort the deletion instead.
  if (unmatchedSourceLessonIds.length > 0) {
    return {
      remappedLinks: 0,
      unmatchedSourceLessonIds,
    };
  }

  const newLinks: Array<{
    lessonId: string;
    substitutionId: string;
  }> = [];

  for (const link of sourceLinks) {
    const targetLessonId = targetBySourceId.get(link.lessonId);

    if (targetLessonId) {
      newLinks.push({
        lessonId: targetLessonId,
        substitutionId: link.substitutionId,
      });
    }
  }

  if (newLinks.length > 0) {
    await tx
      .insert(substitutionLessonMTM)
      .values(newLinks)
      .onConflictDoNothing();

    await tx
      .delete(substitutionLessonMTM)
      .where(inArray(substitutionLessonMTM.lessonId, sourceLessonIds));
  }

  return {
    remappedLinks: newLinks.length,
    unmatchedSourceLessonIds: [],
  };
};
