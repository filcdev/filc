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

// Resolve every matching day definition from the standalone day-definition
// table via the date's weekday. Imports can create several definitions, so
// callers must decide how to handle ambiguity.
export async function getDayDefinitionIdsForDate(
  date: Date
): Promise<string[]> {
  const weekday = getWeekdayInBudapest(date);
  const rows = await db
    .select({
      id: dayDefinition.id,
      name: dayDefinition.name,
      short: dayDefinition.short,
    })
    .from(dayDefinition);

  return rows
    .filter((row) => isMatchingWeekday(weekday, row.name, row.short))
    .map((row) => row.id);
}

// Find an existing lesson that matches the manual parameters, or create one if
// none exists yet. Returns the lesson id.
export async function findOrCreateManualLesson(
  tx: TxOrDb,
  params: {
    classroomIds?: string[] | undefined;
    cohortId: string;
    dayDefinitionId: string;
    periodId: string;
    subjectId: string | null;
    teacherIds?: string[] | undefined;
    termDefinitionId: string | null;
    timetableId: string;
    weeksDefinitionId: string;
  }
): Promise<string> {
  const {
    classroomIds,
    cohortId,
    dayDefinitionId,
    periodId,
    subjectId,
    teacherIds,
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

  // An omitted array is a wildcard (no constraint); a present array must match
  // the stored array exactly, including an empty one. `coalesce` normalises
  // null arrays to empty so a lesson with no teachers/classrooms matches `[]`.
  if (teacherIds !== undefined) {
    conditions.push(
      sql`coalesce(${lesson.teacherIds}, ARRAY[]::text[]) = ARRAY[${sql.join(
        teacherIds.map((id) => sql`${id}`),
        sql`, `
      )}]::text[]`
    );
  }

  if (classroomIds !== undefined) {
    conditions.push(
      sql`coalesce(${lesson.classroomIds}, ARRAY[]::text[]) = ARRAY[${sql.join(
        classroomIds.map((id) => sql`${id}`),
        sql`, `
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
