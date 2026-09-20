import { and, eq, isNull, type SQL, sql } from 'drizzle-orm';
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
    /** How the teacher/classroom arrays are matched against stored lessons. */
    match?: 'exact' | 'contains';
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
    match = 'exact',
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

  // Build the array-match condition. `undefined` is always a wildcard (no
  // constraint). In `contains` mode an empty array is also a wildcard, because
  // an empty containment test would match every lesson; in `exact` mode an
  // empty array matches lessons with no entries. `coalesce` normalises null
  // arrays to empty so exact matching treats null and [] alike.
  const arrayCondition = (
    column: typeof lesson.teacherIds | typeof lesson.classroomIds,
    value: string[] | undefined
  ): SQL<unknown> | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (match === 'contains' && value.length === 0) {
      return undefined;
    }
    const list = sql.join(
      value.map((id) => sql`${id}`),
      sql`, `
    );
    return match === 'contains'
      ? sql`${column} @> ARRAY[${list}]::text[]`
      : sql`coalesce(${column}, ARRAY[]::text[]) = ARRAY[${list}]::text[]`;
  };

  const conditions: SQL<unknown>[] = [
    eq(lessonCohortMTM.cohortId, cohortId),
    eq(lesson.timetableId, timetableId),
    eq(lesson.dayDefinitionId, dayDefinitionId),
    eq(lesson.periodId, periodId),
    subjectCondition,
  ];

  const teacherCondition = arrayCondition(lesson.teacherIds, teacherIds);
  if (teacherCondition) {
    conditions.push(teacherCondition);
  }

  const classroomCondition = arrayCondition(lesson.classroomIds, classroomIds);
  if (classroomCondition) {
    conditions.push(classroomCondition);
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
    // `undefined` is only a match wildcard; a created lesson stores [] (never
    // NULL) so nothing that reads the array as required breaks.
    classroomIds: classroomIds ?? [],
    dayDefinitionId,
    groupsIds: [],
    id: lessonId,
    periodId,
    periodsPerWeek: 1,
    subjectId,
    teacherIds: teacherIds ?? [],
    termDefinitionId,
    timetableId,
    weeksDefinitionId,
  });
  await tx.insert(lessonCohortMTM).values({ cohortId, lessonId });
  return lessonId;
}
