import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '#database';
import {
  dayDefinition,
  lesson,
  lessonCohortMTM,
} from '#database/schema/timetable';
import {
  getWeekdayInBudapest,
  isMatchingWeekday,
} from '#utils/timetable/weekday';

// Type for both database and transaction instances used by helpers
export type TxOrDb =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Resolve the matching day definition from the standalone day-definition table
// via the date's weekday.
export async function getDayDefinitionIdForDate(
  date: Date
): Promise<string | null> {
  const weekday = getWeekdayInBudapest(date);
  const rows = await db
    .select({
      id: dayDefinition.id,
      name: dayDefinition.name,
      short: dayDefinition.short,
    })
    .from(dayDefinition);

  const match = rows.find((row) =>
    isMatchingWeekday(weekday, row.name, row.short)
  );
  return match?.id ?? null;
}

// Find an existing lesson that matches the manual parameters, or create one if
// none exists yet. Returns the lesson id.
export async function findOrCreateManualLesson(
  tx: TxOrDb,
  params: {
    classroomIds?: string[];
    cohortId: string;
    dayDefinitionId: string;
    periodId: string;
    subjectId: string | null;
    teacherIds?: string[];
    termDefinitionId: string | null;
    timetableId: string;
    weeksDefinitionId: string;
  }
): Promise<string> {
  const {
    classroomIds = [],
    cohortId,
    dayDefinitionId,
    periodId,
    subjectId,
    teacherIds = [],
    termDefinitionId,
    timetableId,
    weeksDefinitionId,
  } = params;

  const subjectCondition =
    subjectId === null
      ? isNull(lesson.subjectId)
      : eq(lesson.subjectId, subjectId);

  const conditions = [
    eq(lessonCohortMTM.cohortId, cohortId),
    eq(lesson.timetableId, timetableId),
    eq(lesson.dayDefinitionId, dayDefinitionId),
    eq(lesson.periodId, periodId),
    subjectCondition,
  ];

  // Array containment only when there is something to match against; an empty
  // array would match everything.
  if (teacherIds.length > 0) {
    conditions.push(
      sql`${lesson.teacherIds} @> ARRAY[${sql.join(
        teacherIds.map((id) => sql`${id}`)
      )}]::text[]`
    );
  }

  if (classroomIds.length > 0) {
    conditions.push(
      sql`${lesson.classroomIds} @> ARRAY[${sql.join(
        classroomIds.map((id) => sql`${id}`)
      )}]::text[]`
    );
  }

  const existing = await tx
    .select({ lessonId: lessonCohortMTM.lessonId })
    .from(lessonCohortMTM)
    .innerJoin(lesson, eq(lessonCohortMTM.lessonId, lesson.id))
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    return existing[0]?.lessonId ?? '';
  }

  const lessonId = crypto.randomUUID();
  await tx.insert(lesson).values({
    classroomIds,
    dayDefinitionId,
    groupsIds: [],
    id: lessonId,
    periodId,
    periodsPerWeek: 1,
    subjectId,
    teacherIds,
    termDefinitionId,
    timetableId,
    weeksDefinitionId,
  });
  await tx.insert(lessonCohortMTM).values({ cohortId, lessonId });
  return lessonId;
}

/**
 * Resolve the single lesson occupying a cohort's slot in the active timetable.
 * Matches on cohort + day + period (+ room when given), regardless of subject or
 * teacher, so the caller can reuse the real lesson's teachers/subject.
 * Returns null when there is no match or when the match is ambiguous.
 */
export async function findLessonForSlot(
  tx: TxOrDb,
  params: {
    cohortId: string;
    dayDefinitionId: string;
    periodId: string;
    roomId?: string;
    timetableId: string;
  }
): Promise<string | null> {
  const { cohortId, dayDefinitionId, periodId, roomId, timetableId } = params;

  const conditions = [
    eq(lessonCohortMTM.cohortId, cohortId),
    eq(lesson.timetableId, timetableId),
    eq(lesson.dayDefinitionId, dayDefinitionId),
    eq(lesson.periodId, periodId),
  ];

  if (roomId) {
    conditions.push(sql`${lesson.classroomIds} @> ARRAY[${roomId}]::text[]`);
  }

  const rows = await tx
    .select({ lessonId: lessonCohortMTM.lessonId })
    .from(lessonCohortMTM)
    .innerJoin(lesson, eq(lessonCohortMTM.lessonId, lesson.id))
    .where(and(...conditions))
    .limit(2);

  if (rows.length !== 1) {
    return null;
  }

  return rows[0]?.lessonId ?? null;
}
