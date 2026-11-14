import type { Lesson } from '@filcdev/api/domains/timetable/lesson';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { userPreferences } from '#modules/notifications/schema';
import {
  classroom,
  cohort,
  dayDefinition,
  movedLesson,
  movedLessonLessonMTM,
  period,
  subject,
  teacher,
} from '#modules/timetable/schema';
import {
  enrichLessons,
  loadLessonsByIds,
} from '#modules/timetable/utils/enrich-lessons';
import { uniqueStrings } from '#utils/notifications/substitution-teacher';
import type { AudienceUser } from '#utils/notifications/types';

// Shared by every moved-lesson list endpoint: rows carry the target joins and
// their linked lessons already enriched.
// Row shape returned by each moved-lesson query before lesson enrichment.
type MovedLessonRow = {
  classroom: typeof classroom.$inferSelect | null;
  dayDefinition: typeof dayDefinition.$inferSelect | null;
  lessons: string[];
  movedLesson: typeof movedLesson.$inferSelect;
  period: typeof period.$inferSelect | null;
};

// A manual move is recognised by any manual field, not just the subject: a
// subject deleted via ON DELETE SET NULL leaves `manualSubjectId` null while
// the cohort/teacher/source-room ids remain, and that must still render as a
// manual row (with a null subject) rather than a linked row with no lessons.
const hasManualFields = (row: typeof movedLesson.$inferSelect): boolean =>
  row.manualSubjectId !== null ||
  row.manualCohortIds.length > 0 ||
  row.manualTeacherIds.length > 0 ||
  row.manualSourceRoomId !== null;

// Enrich the linked lesson ids of a batch of moved-lesson rows, preserving the
// target joins and the per-moved-lesson lesson order. A moved lesson keeps
// pointing at the lesson it was created for, even after that lesson's timetable
// is retired, so this must not be scoped to the active timetable. For manual
// moves it also resolves the manual subject, cohorts and teachers (two batched
// lookups across the whole batch, preserving the stored id order).
export async function attachEnrichedLessons(rows: MovedLessonRow[]) {
  const allLessonIds = Array.from(new Set(rows.flatMap((r) => r.lessons)));
  const enriched = await enrichLessons(await loadLessonsByIds(allLessonIds));
  const lessonMap = new Map(enriched.map((l) => [l.id, l]));

  const manualSubjectIds = Array.from(
    new Set(
      rows
        .map((r) => r.movedLesson.manualSubjectId)
        .filter((id): id is string => id !== null)
    )
  );
  const manualCohortIds = Array.from(
    new Set(rows.flatMap((r) => r.movedLesson.manualCohortIds))
  );
  const manualTeacherIds = Array.from(
    new Set(rows.flatMap((r) => r.movedLesson.manualTeacherIds))
  );
  const manualSourceRoomIds = Array.from(
    new Set(
      rows
        .map((r) => r.movedLesson.manualSourceRoomId)
        .filter((id): id is string => id !== null)
    )
  );

  const [subjects, cohorts, teachers, sourceRooms] = await Promise.all([
    manualSubjectIds.length
      ? db.select().from(subject).where(inArray(subject.id, manualSubjectIds))
      : Promise.resolve([] as (typeof subject.$inferSelect)[]),
    manualCohortIds.length
      ? db
          .select({ id: cohort.id, name: cohort.name, short: cohort.short })
          .from(cohort)
          .where(inArray(cohort.id, manualCohortIds))
      : Promise.resolve([] as { id: string; name: string; short: string }[]),
    manualTeacherIds.length
      ? db
          .select({
            firstName: teacher.firstName,
            id: teacher.id,
            lastName: teacher.lastName,
            short: teacher.short,
          })
          .from(teacher)
          .where(inArray(teacher.id, manualTeacherIds))
      : Promise.resolve(
          [] as {
            firstName: string;
            id: string;
            lastName: string;
            short: string;
          }[]
        ),
    manualSourceRoomIds.length
      ? db
          .select({
            id: classroom.id,
            name: classroom.name,
            short: classroom.short,
          })
          .from(classroom)
          .where(inArray(classroom.id, manualSourceRoomIds))
      : Promise.resolve([] as { id: string; name: string; short: string }[]),
  ]);

  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const cohortMap = new Map(cohorts.map((c) => [c.id, c]));
  const teacherMap = new Map(
    teachers.map((t) => [
      t.id,
      { id: t.id, name: `${t.firstName} ${t.lastName}`.trim(), short: t.short },
    ])
  );
  const sourceRoomMap = new Map(sourceRooms.map((cr) => [cr.id, cr]));

  return rows.map((r) => {
    const manual = hasManualFields(r.movedLesson)
      ? {
          cohorts: r.movedLesson.manualCohortIds
            .map((id) => cohortMap.get(id))
            .filter((c): c is NonNullable<typeof c> => c !== undefined),
          sourceRoom: r.movedLesson.manualSourceRoomId
            ? (sourceRoomMap.get(r.movedLesson.manualSourceRoomId) ?? null)
            : null,
          subject: r.movedLesson.manualSubjectId
            ? (subjectMap.get(r.movedLesson.manualSubjectId) ?? null)
            : null,
          teachers: r.movedLesson.manualTeacherIds
            .map((id) => teacherMap.get(id))
            .filter((t): t is NonNullable<typeof t> => t !== undefined),
        }
      : null;

    return {
      classroom: r.classroom,
      dayDefinition: r.dayDefinition,
      lessons: r.lessons
        .map((id) => lessonMap.get(id))
        .filter((l): l is Lesson => l !== undefined),
      manual,
      movedLesson: r.movedLesson,
      period: r.period,
    };
  });
}

/**
 * Everything the moved-lesson email builders read off one moved lesson. The
 * payload carries display values: `startingDay` is the day name,
 * `startingPeriod` the period number as a string and `room` the room name, all
 * already resolved from the row's joins. `teacherIds` is the exception — the
 * teacher-facing audience needs the ids to resolve their user accounts.
 */
export type MovedLessonNotificationPayload = {
  cohortIds: string[];
  cohortNames: string[];
  comment: string | null;
  date: Date;
  lessonIds: string[];
  original: {
    day: string | null;
    /** True when the linked lessons started in more than one distinct slot. */
    hasMultipleSlots: boolean;
    period: number | null;
    room: string | null;
    teacherNames: string[];
  };
  /** Resolved room name of the new slot. */
  room: string | null;
  /** Resolved name of the new slot's day. */
  startingDay: string | null;
  /** Resolved period number of the new slot, as a string. */
  startingPeriod: string | null;
  subjectNames: string[];
  target: {
    day: string | null;
    period: number | null;
    room: string | null;
  };
  /** Ids of the teachers whose lesson moved; the teacher notification audience. */
  teacherIds: string[];
};

type EnrichedMovedLesson = Awaited<
  ReturnType<typeof attachEnrichedLessons>
>[number];

/** The resolved display values of one moved lesson's new slot. */
function movedLessonTarget(enriched: EnrichedMovedLesson) {
  const periodNumber = enriched.period?.period ?? null;
  return {
    day: enriched.dayDefinition?.name ?? null,
    period: periodNumber,
    periodText: periodNumber == null ? null : String(periodNumber),
    room: enriched.classroom?.name ?? null,
  };
}

/** The audience cohort ids and their display names for one moved lesson. */
function movedLessonCohorts(enriched: EnrichedMovedLesson): {
  cohortIds: string[];
  cohortNames: string[];
} {
  if (enriched.manual) {
    return {
      cohortIds: enriched.movedLesson.manualCohortIds,
      cohortNames: uniqueStrings(enriched.manual.cohorts.map((c) => c.name)),
    };
  }

  return {
    cohortIds: enriched.lessons.flatMap((l) => l.cohorts.map((c) => c.id)),
    cohortNames: uniqueStrings(
      enriched.lessons.flatMap((l) => l.cohorts.map((c) => c.name))
    ),
  };
}

/**
 * Load one moved lesson with the same enriched relations the list endpoint
 * uses, shaped for the notification builders. Returns null when the row no
 * longer exists.
 */
export async function loadMovedLessonNotificationPayload(
  movedLessonId: string
): Promise<MovedLessonNotificationPayload | null> {
  const [row] = await db
    .select({
      classroom,
      dayDefinition,
      lessons: sql<string[]>`COALESCE(
          ARRAY_AGG(DISTINCT ${movedLessonLessonMTM.lessonId}) FILTER (WHERE ${movedLessonLessonMTM.lessonId} IS NOT NULL),
          ARRAY[]::text[]
        )`.as('lessons'),
      movedLesson,
      period,
    })
    .from(movedLesson)
    .leftJoin(period, eq(movedLesson.startingPeriod, period.id))
    .leftJoin(dayDefinition, eq(movedLesson.startingDay, dayDefinition.id))
    .leftJoin(classroom, eq(movedLesson.room, classroom.id))
    .leftJoin(
      movedLessonLessonMTM,
      eq(movedLesson.id, movedLessonLessonMTM.movedLessonId)
    )
    .where(eq(movedLesson.id, movedLessonId))
    .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

  if (!row) {
    return null;
  }

  const [enriched] = await attachEnrichedLessons([row]);
  if (!enriched) {
    return null;
  }

  const lessonRow = enriched.movedLesson;
  const lessons = enriched.lessons;
  const manual = enriched.manual;

  const { cohortIds, cohortNames } = movedLessonCohorts(enriched);
  const target = movedLessonTarget(enriched);
  const subjectNames = manual
    ? uniqueStrings([manual.subject?.name])
    : uniqueStrings(lessons.map((l) => l.subject?.name));
  const teacherNames = manual
    ? uniqueStrings(manual.teachers.map((t) => t.name))
    : uniqueStrings(lessons.flatMap((l) => l.teachers.map((t) => t.name)));
  const teacherIds = manual
    ? uniqueStrings(manual.teachers.map((t) => t.id))
    : uniqueStrings(lessons.flatMap((l) => l.teachers.map((t) => t.id)));
  const originalRooms = manual
    ? uniqueStrings([manual.sourceRoom?.name])
    : uniqueStrings(lessons.flatMap((l) => l.classrooms.map((c) => c.name)));
  // A linked move can carry lessons from different original slots; only a
  // single distinct day/period pair can be shown as "the" original slot.
  const originalSlots = manual
    ? []
    : Array.from(
        new Map(
          lessons.map((l) => [
            `${l.day?.name ?? ''}\u0000${l.period?.period ?? ''}`,
            { day: l.day?.name ?? null, period: l.period?.period ?? null },
          ])
        ).values()
      );
  const [originalSlot] = originalSlots;

  return {
    cohortIds,
    cohortNames,
    comment: lessonRow.comment,
    date: lessonRow.date,
    lessonIds: lessons.map((l) => l.id),
    original: {
      day: originalSlot?.day ?? null,
      hasMultipleSlots: originalSlots.length > 1,
      period: originalSlot?.period ?? null,
      room: originalRooms.join(', ') || null,
      teacherNames,
    },
    room: target.room,
    startingDay: target.day,
    startingPeriod: target.periodText,
    subjectNames,
    target: {
      day: target.day,
      period: target.period,
      room: target.room,
    },
    teacherIds,
  };
}

/**
 * The teachers of a moved lesson as notification recipients. A `teacher` row
 * is the only link between a lesson and a user account, so a teacher without a
 * `userId` has nobody to notify and is dropped.
 */
export async function resolveMovedLessonTeacherAudience(
  payload: MovedLessonNotificationPayload
): Promise<AudienceUser[]> {
  if (payload.teacherIds.length === 0) {
    return [];
  }

  const teacherRows = await db
    .select({ userId: teacher.userId })
    .from(teacher)
    .where(inArray(teacher.id, payload.teacherIds));

  const userIds = uniqueStrings(teacherRows.map((row) => row.userId));

  if (userIds.length === 0) {
    return [];
  }

  const [users, prefs] = await Promise.all([
    db
      .select({
        cohortId: userTable.cohortId,
        email: userTable.email,
        id: userTable.id,
      })
      .from(userTable)
      .where(inArray(userTable.id, userIds)),
    db
      .select({
        language: userPreferences.language,
        userId: userPreferences.userId,
      })
      .from(userPreferences)
      .where(inArray(userPreferences.userId, userIds)),
  ]);

  const languageMap = new Map(prefs.map((p) => [p.userId, p.language]));

  return users.map((user) => ({
    cohortId: user.cohortId,
    email: user.email,
    id: user.id,
    language: languageMap.get(user.id) ?? 'hu',
  }));
}
