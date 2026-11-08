import type { Lesson } from '@filcdev/api/domains/timetable/lesson';
import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { and, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import {
  diffActivity,
  recordActivity,
} from '#modules/activity-log/utils/record';
import {
  classroom,
  cohort,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  movedLesson,
  movedLessonLessonMTM,
  period,
  subject,
  teacher,
} from '#modules/timetable/schema';
import { getActiveTimetableId } from '#modules/timetable/utils/active';
import {
  enrichLessons,
  loadLessonsByIds,
} from '#modules/timetable/utils/enrich-lessons';
import { base } from '#orpc';
import { badRequest, notFound } from '#utils/http';
import {
  cancelPendingNotification,
  dispatchPendingNotification,
} from '#utils/notifications/engine';

const ensurePeriodExists = async (periodId: string) => {
  const [existingPeriod] = await db
    .select({ periodId: period.id })
    .from(period)
    .where(eq(period.id, periodId));

  if (!existingPeriod) {
    throw badRequest('Invalid starting period provided');
  }
};

const ensureDayDefinitionExists = async (dayId: string) => {
  const [existingDay] = await db
    .select({ dayId: dayDefinition.id })
    .from(dayDefinition)
    .where(eq(dayDefinition.id, dayId));

  if (!existingDay) {
    throw badRequest('Invalid starting day provided');
  }
};

const ensureClassroomExists = async (classroomId: string) => {
  const [existingRoom] = await db
    .select({ classroomId: classroom.id })
    .from(classroom)
    .where(eq(classroom.id, classroomId));

  if (!existingRoom) {
    throw badRequest('Invalid classroom provided');
  }
};

const ensureLessonsExist = async (
  lessonIds: string[]
): Promise<{ periodId: string }[]> => {
  const timetableId = await getActiveTimetableId();

  const lessonRecords = await db
    .select({ lessonId: lesson.id, periodId: lesson.periodId })
    .from(lesson)
    .where(
      timetableId
        ? and(
            inArray(lesson.id, lessonIds),
            eq(lesson.timetableId, timetableId)
          )
        : sql`false`
    );

  const foundLessonIds = new Set(lessonRecords.map(({ lessonId }) => lessonId));
  const missingLessonIds = lessonIds.filter(
    (lessonId) => !foundLessonIds.has(lessonId)
  );

  if (missingLessonIds.length > 0) {
    throw badRequest(
      `Invalid lesson ids provided: ${missingLessonIds.join(', ')}`
    );
  }

  return lessonRecords;
};

const ensureSubjectExists = async (subjectId: string): Promise<void> => {
  const [existingSubject] = await db
    .select({ id: subject.id })
    .from(subject)
    .where(eq(subject.id, subjectId));

  if (!existingSubject) {
    throw badRequest('Invalid manual subject provided');
  }
};

const ensureCohortsExist = async (cohortIds: string[]): Promise<void> => {
  const cohortRecords = await db
    .select({ id: cohort.id })
    .from(cohort)
    .where(inArray(cohort.id, cohortIds));

  const found = new Set(cohortRecords.map(({ id }) => id));
  const missing = cohortIds.filter((id) => !found.has(id));

  if (missing.length > 0) {
    throw badRequest(
      `Invalid manual cohort ids provided: ${missing.join(', ')}`
    );
  }
};

const ensureTeachersExist = async (teacherIds: string[]): Promise<void> => {
  const teacherRecords = await db
    .select({ id: teacher.id })
    .from(teacher)
    .where(inArray(teacher.id, teacherIds));

  const found = new Set(teacherRecords.map(({ id }) => id));
  const missing = teacherIds.filter((id) => !found.has(id));

  if (missing.length > 0) {
    throw badRequest(
      `Invalid manual teacher ids provided: ${missing.join(', ')}`
    );
  }
};

const normalizeOptionalString = (
  value: unknown,
  label: string
): string | undefined => {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'string') {
    throw badRequest(`${label} must be a string`);
  }

  return value;
};

const normalizeOptionalStringArray = (
  value: unknown,
  label: string
): string[] | undefined => {
  if (value === undefined || value === null) {
    return;
  }

  if (!Array.isArray(value)) {
    throw badRequest(`${label} must be an array`);
  }

  return value.map((entry) => {
    if (typeof entry !== 'string') {
      throw badRequest(`${label} must contain only strings`);
    }

    return entry;
  });
};

const validateMovedLessonReferences = async (options: {
  startingPeriod?: unknown;
  startingDay?: unknown;
  room?: unknown;
  lessonIds?: unknown;
  manualSubjectId?: unknown;
  manualCohortIds?: unknown;
  manualTeacherIds?: unknown;
  manualSourceRoomId?: unknown;
}) => {
  const {
    startingPeriod,
    startingDay,
    room,
    lessonIds,
    manualSubjectId,
    manualCohortIds,
    manualTeacherIds,
    manualSourceRoomId,
  } = options;

  const normalizedStartingPeriod = normalizeOptionalString(
    startingPeriod,
    'Starting period'
  );
  if (normalizedStartingPeriod) {
    await ensurePeriodExists(normalizedStartingPeriod);
  }

  const normalizedStartingDay = normalizeOptionalString(
    startingDay,
    'Starting day'
  );
  if (normalizedStartingDay) {
    await ensureDayDefinitionExists(normalizedStartingDay);
  }

  const normalizedRoom = normalizeOptionalString(room, 'Classroom');
  if (normalizedRoom) {
    await ensureClassroomExists(normalizedRoom);
  }

  const normalizedLessonIds = normalizeOptionalStringArray(
    lessonIds,
    'Lesson ids'
  );
  if (normalizedLessonIds && normalizedLessonIds.length > 0) {
    const lessonRecords = await ensureLessonsExist(normalizedLessonIds);

    if (
      normalizedStartingPeriod &&
      lessonRecords.some(
        ({ periodId }) => periodId !== normalizedStartingPeriod
      )
    ) {
      throw badRequest('Provided lessons do not match the starting period');
    }
  }

  const normalizedManualSubjectId = normalizeOptionalString(
    manualSubjectId,
    'Manual subject'
  );
  if (normalizedManualSubjectId) {
    await ensureSubjectExists(normalizedManualSubjectId);
  }

  const normalizedManualSourceRoomId = normalizeOptionalString(
    manualSourceRoomId,
    'Manual source room'
  );
  if (normalizedManualSourceRoomId) {
    await ensureClassroomExists(normalizedManualSourceRoomId);
  }

  const normalizedManualCohortIds = normalizeOptionalStringArray(
    manualCohortIds,
    'Manual cohorts'
  );
  if (normalizedManualCohortIds && normalizedManualCohortIds.length > 0) {
    await ensureCohortsExist(normalizedManualCohortIds);
  }

  const normalizedManualTeacherIds = normalizeOptionalStringArray(
    manualTeacherIds,
    'Manual teachers'
  );
  if (normalizedManualTeacherIds && normalizedManualTeacherIds.length > 0) {
    await ensureTeachersExist(normalizedManualTeacherIds);
  }
};

// A moved lesson has exactly one source: linked lessons (≥1 `lessonIds`) or a
// manual source (`manualSubjectId` + ≥1 `manualCohortIds`). Sending both is a
// mixing error; sending neither is a missing-source error.
const resolveMovedLessonMode = (options: {
  lessonIds?: string[];
  manualCohortIds?: string[];
  manualSubjectId?: string | null;
}): 'linked' | 'manual' => {
  const hasLessons = (options.lessonIds?.length ?? 0) > 0;
  const hasManual =
    options.manualSubjectId != null &&
    (options.manualCohortIds?.length ?? 0) > 0;

  if (hasLessons && hasManual) {
    throw badRequest('Provide either lessonIds or a manual source, not both');
  }

  if (!(hasLessons || hasManual)) {
    throw badRequest(
      'Provide either at least one lessonId or a manual subject with at least one cohort'
    );
  }

  return hasManual ? 'manual' : 'linked';
};

// Resolve the effective source of an update patch. When the patch carries any
// source field, the merged combination is validated (mix → reject, neither →
// reject) and the other source is cleared; otherwise the stored mode is left
// untouched (`source: null`, e.g. a room-only edit).
const resolveUpdateSource = (options: {
  existing: typeof movedLesson.$inferSelect;
  lessonIds: string[] | undefined;
  manualCohortIds: string[] | undefined;
  manualSourceRoomId: string | null | undefined;
  manualSubjectId: string | undefined;
  manualTeacherIds: string[] | undefined;
  storedLessonIds: string[];
}): {
  effectiveLessonIds: string[];
  effectiveManualCohortIds: string[];
  effectiveManualSourceRoomId: string | null;
  effectiveManualSubjectId: string | null;
  effectiveManualTeacherIds: string[];
  source: 'linked' | 'manual' | null;
} => {
  const {
    existing,
    lessonIds,
    manualCohortIds,
    manualSourceRoomId,
    manualSubjectId,
    manualTeacherIds,
    storedLessonIds,
  } = options;

  const effectiveLessonIds = lessonIds ?? storedLessonIds;
  const effectiveManualSubjectId =
    manualSubjectId === undefined ? existing.manualSubjectId : manualSubjectId;
  const effectiveManualCohortIds = manualCohortIds ?? existing.manualCohortIds;
  const effectiveManualTeacherIds =
    manualTeacherIds ?? existing.manualTeacherIds;
  const effectiveManualSourceRoomId =
    manualSourceRoomId === undefined
      ? existing.manualSourceRoomId
      : manualSourceRoomId;

  const sourcePatchPresent =
    lessonIds !== undefined ||
    manualCohortIds !== undefined ||
    manualSourceRoomId !== undefined ||
    manualSubjectId !== undefined ||
    manualTeacherIds !== undefined;

  const source = sourcePatchPresent
    ? resolveMovedLessonMode({
        lessonIds: effectiveLessonIds,
        manualCohortIds: effectiveManualCohortIds,
        manualSubjectId: effectiveManualSubjectId,
      })
    : null;

  return {
    effectiveLessonIds,
    effectiveManualCohortIds,
    effectiveManualSourceRoomId,
    effectiveManualSubjectId,
    effectiveManualTeacherIds,
    source,
  };
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The column set an update writes: the scalar patch plus the manual columns
// (cleared when switching to linked, applied when switching to manual).
const buildUpdateSetValues = (
  columns: Partial<typeof movedLesson.$inferInsert>,
  source: 'linked' | 'manual' | null,
  manual: {
    cohortIds: string[];
    sourceRoomId: string | null;
    subjectId: string | null;
    teacherIds: string[];
  }
): Partial<typeof movedLesson.$inferInsert> => {
  const setValues: Partial<typeof movedLesson.$inferInsert> = { ...columns };

  if (source === 'linked') {
    setValues.manualCohortIds = [];
    setValues.manualSourceRoomId = null;
    setValues.manualSubjectId = null;
    setValues.manualTeacherIds = [];
  } else if (source === 'manual') {
    setValues.manualCohortIds = manual.cohortIds;
    setValues.manualSourceRoomId = manual.sourceRoomId;
    setValues.manualSubjectId = manual.subjectId;
    setValues.manualTeacherIds = manual.teacherIds;
  }

  return setValues;
};

// Replace the lesson links when switching to linked, clear them when switching
// to manual, and leave them alone otherwise.
const syncMovedLessonLinks = async (
  tx: Tx,
  movedLessonId: string,
  source: 'linked' | 'manual' | null,
  lessonIds: string[] | undefined
): Promise<void> => {
  if (source === 'linked' && lessonIds !== undefined) {
    await tx
      .delete(movedLessonLessonMTM)
      .where(eq(movedLessonLessonMTM.movedLessonId, movedLessonId));

    if (lessonIds.length > 0) {
      await tx.insert(movedLessonLessonMTM).values(
        lessonIds.map((lessonId) => ({
          lessonId,
          movedLessonId,
        }))
      );
    }
  } else if (source === 'manual') {
    await tx
      .delete(movedLessonLessonMTM)
      .where(eq(movedLessonLessonMTM.movedLessonId, movedLessonId));
  }
};

// The audit metadata for a created moved lesson: the scalar inputs plus the
// resolved manual ids (null/empty for linked moves).
const buildCreateMetadata = (input: {
  date: Date;
  lessonIds?: string[];
  manualCohortIds?: string[];
  manualSourceRoomId?: string;
  manualSubjectId?: string;
  manualTeacherIds?: string[];
  room?: string | null;
  startingDay?: string | null;
  startingPeriod?: string | null;
}): Record<string, unknown> => ({
  date: input.date.toISOString(),
  lessonIds: input.lessonIds ?? [],
  manualCohortIds: input.manualCohortIds ?? [],
  manualSourceRoomId: input.manualSourceRoomId ?? null,
  manualSubjectId: input.manualSubjectId ?? null,
  manualTeacherIds: input.manualTeacherIds ?? [],
  room: input.room ?? null,
  startingDay: input.startingDay ?? null,
  startingPeriod: input.startingPeriod ?? null,
});

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
async function attachEnrichedLessons(rows: MovedLessonRow[]) {
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

export const getAllMovedLessons = base.timetable.movedLessons.list.handler(
  async () => {
    const movedLessons = await db
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
      .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

    const items = await attachEnrichedLessons(movedLessons);
    return { items, total: items.length };
  }
);

export const getRelevantMovedLessons =
  base.timetable.movedLessons.relevant.handler(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const movedLessons = await db
      .select({
        classroom,
        dayDefinition,
        lessons: sql<string[]>`COALESCE(
          ARRAY_AGG(${movedLessonLessonMTM.lessonId}) FILTER (WHERE ${movedLessonLessonMTM.lessonId} IS NOT NULL),
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
      .where(gte(movedLesson.date, today))
      .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

    const items = await attachEnrichedLessons(movedLessons);
    return { items, total: items.length };
  });

export const getMovedLessonsForCohort =
  base.timetable.movedLessons.forCohort.handler(async ({ input }) => {
    const { cohortId } = input;

    const movedLessons = await db
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
      .leftJoin(lesson, eq(movedLessonLessonMTM.lessonId, lesson.id))
      .leftJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
      .where(
        or(
          eq(lessonCohortMTM.cohortId, cohortId),
          sql`${movedLesson.manualCohortIds} @> ARRAY[${cohortId}]::text[]`
        )
      )
      .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

    const items = await attachEnrichedLessons(movedLessons);
    return { items, total: items.length };
  });

export const getRelevantMovedLessonsForCohort =
  base.timetable.movedLessons.relevantForCohort.handler(async ({ input }) => {
    const { cohortId } = input;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const movedLessons = await db
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
      .leftJoin(lesson, eq(movedLessonLessonMTM.lessonId, lesson.id))
      .leftJoin(lessonCohortMTM, eq(lesson.id, lessonCohortMTM.lessonId))
      .where(
        and(
          or(
            eq(lessonCohortMTM.cohortId, cohortId),
            sql`${movedLesson.manualCohortIds} @> ARRAY[${cohortId}]::text[]`
          ),
          gte(movedLesson.date, today)
        )
      )
      .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

    const items = await attachEnrichedLessons(movedLessons);
    return { items, total: items.length };
  });

export const createMovedLesson = base.timetable.movedLessons.create
  .use(requireAuthorization(permissions.movedLessonCreate))
  .handler(async ({ context, input }) => {
    const body = input;
    const {
      comment,
      date,
      lessonIds,
      manualCohortIds,
      manualSourceRoomId,
      manualSubjectId,
      manualTeacherIds,
      room,
      startingDay,
      startingPeriod,
    } = body;

    if (!date) {
      throw badRequest('Date is required');
    }

    const mode = resolveMovedLessonMode({
      lessonIds,
      manualCohortIds,
      manualSubjectId,
    });

    await validateMovedLessonReferences({
      lessonIds,
      manualCohortIds,
      manualSourceRoomId,
      manualSubjectId,
      manualTeacherIds,
      room,
      startingDay,
      startingPeriod,
    });

    // A linked move stores no manual fields, even if the client sent stray
    // manual ids alongside the lesson ids (the schema only requires one
    // source). This mirrors `buildUpdateSetValues` so a linked row can never
    // carry a half-manual payload into the notification audience.
    const manualValues: {
      manualCohortIds: string[];
      manualSourceRoomId: string | null;
      manualSubjectId: string | null;
      manualTeacherIds: string[];
    } =
      mode === 'linked'
        ? {
            manualCohortIds: [],
            manualSourceRoomId: null,
            manualSubjectId: null,
            manualTeacherIds: [],
          }
        : {
            manualCohortIds: manualCohortIds ?? [],
            manualSourceRoomId: manualSourceRoomId ?? null,
            manualSubjectId: manualSubjectId ?? null,
            manualTeacherIds: manualTeacherIds ?? [],
          };

    // Row and lesson links are one unit: a failure between them leaves a moved
    // lesson with no lessons, which nothing downstream can repair.
    const newMovedLesson = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(movedLesson)
        .values({
          comment,
          date,
          id: crypto.randomUUID(),
          ...manualValues,
          room,
          startingDay,
          startingPeriod,
        })
        .returning();

      if (!row) {
        throw new ORPCError('INTERNAL', {
          message: 'Failed to create moved lesson',
        });
      }

      if (mode === 'linked') {
        await tx.insert(movedLessonLessonMTM).values(
          (lessonIds ?? []).map((lessonId) => ({
            lessonId,
            movedLessonId: row.id,
          }))
        );
      }

      await recordActivity(
        context,
        {
          action: 'create',
          entityId: row.id,
          entityType: 'movedLesson',
          metadata: buildCreateMetadata(body),
        },
        tx
      );

      return row;
    });

    dispatchPendingNotification(newMovedLesson.id, 'moved_lesson', {
      cohortIds: manualValues.manualCohortIds,
      date: newMovedLesson.date,
      lessonIds: lessonIds ?? [],
      room: newMovedLesson.room,
      startingDay: newMovedLesson.startingDay,
      startingPeriod: newMovedLesson.startingPeriod,
    });

    return newMovedLesson;
  });

export const updateMovedLesson = base.timetable.movedLessons.update
  .use(requireAuthorization(permissions.movedLessonUpdate))
  .handler(async ({ context, input }) => {
    const {
      id,
      lessonIds,
      manualCohortIds,
      manualSourceRoomId,
      manualSubjectId,
      manualTeacherIds,
      ...columns
    } = input;

    // Read the row before the patch so the audit diff can carry real before values.
    const [existing] = await db
      .select()
      .from(movedLesson)
      .where(eq(movedLesson.id, id));

    if (!existing) {
      throw notFound('Moved lesson not found');
    }

    // Only IDs that are new in this patch are validated. A class or teacher
    // deleted after the move was created stays in the stored array (there is
    // no FK to cascade it), and re-sending that stale id must not make the
    // whole move uneditable.
    await validateMovedLessonReferences({
      ...columns,
      lessonIds,
      manualCohortIds: manualCohortIds?.filter(
        (cohortId) => !existing.manualCohortIds.includes(cohortId)
      ),
      manualSourceRoomId,
      manualSubjectId,
      manualTeacherIds: manualTeacherIds?.filter(
        (teacherId) => !existing.manualTeacherIds.includes(teacherId)
      ),
    });

    cancelPendingNotification(id, 'moved_lesson');

    const storedLessonIds = (
      await db
        .select({ lessonId: movedLessonLessonMTM.lessonId })
        .from(movedLessonLessonMTM)
        .where(eq(movedLessonLessonMTM.movedLessonId, id))
    ).map(({ lessonId }) => lessonId);

    const {
      effectiveLessonIds,
      effectiveManualCohortIds,
      effectiveManualSourceRoomId,
      effectiveManualSubjectId,
      effectiveManualTeacherIds,
      source,
    } = resolveUpdateSource({
      existing,
      lessonIds,
      manualCohortIds,
      manualSourceRoomId,
      manualSubjectId,
      manualTeacherIds,
      storedLessonIds,
    });

    // The row, its lesson links and the manual source are one unit: a failure
    // between them would leave a moved lesson attached to the wrong lessons or
    // a stale manual subject. All writes go in one transaction.
    const updatedMovedLesson = await db.transaction(async (tx) => {
      const setValues = buildUpdateSetValues(columns, source, {
        cohortIds: effectiveManualCohortIds,
        sourceRoomId: effectiveManualSourceRoomId,
        subjectId: effectiveManualSubjectId,
        teacherIds: effectiveManualTeacherIds,
      });

      const [row] =
        Object.keys(setValues).length > 0
          ? await tx
              .update(movedLesson)
              .set(setValues)
              .where(eq(movedLesson.id, id))
              .returning()
          : await tx.select().from(movedLesson).where(eq(movedLesson.id, id));

      if (!row) {
        throw notFound('Moved lesson not found');
      }

      await syncMovedLessonLinks(tx, id, source, lessonIds);

      // Only the fields this PATCH touched, judged against the pre-update row.
      const diff = diffActivity(
        existing,
        setValues,
        [
          'comment',
          'date',
          'manualCohortIds',
          'manualSourceRoomId',
          'manualSubjectId',
          'manualTeacherIds',
          'room',
          'startingDay',
          'startingPeriod',
        ],
        lessonIds === undefined
          ? undefined
          : { after: { lessonIds }, before: { lessonIds: storedLessonIds } }
      );
      if (diff) {
        await recordActivity(
          context,
          {
            action: 'update',
            entityId: id,
            entityType: 'movedLesson',
            metadata: diff,
          },
          tx
        );
      }

      return row;
    });

    // A partial patch must not notify an empty audience, so the payload is the
    // merged result rather than just what the caller sent. A manual move has no
    // lesson links, so the audience is resolved from its manual cohort ids —
    // recognised by `hasManualFields`, not by the subject, because a subject
    // deleted via ON DELETE SET NULL leaves `manualSubjectId` null while the
    // cohorts (and therefore the audience) remain. `createMovedLesson` passes
    // `manualCohortIds` unconditionally for the same reason.
    dispatchPendingNotification(id, 'moved_lesson', {
      cohortIds: hasManualFields(updatedMovedLesson)
        ? updatedMovedLesson.manualCohortIds
        : [],
      date: updatedMovedLesson.date,
      lessonIds: effectiveLessonIds,
      room: updatedMovedLesson.room,
      startingDay: updatedMovedLesson.startingDay,
      startingPeriod: updatedMovedLesson.startingPeriod,
    });

    return updatedMovedLesson;
  });

export const deleteMovedLesson = base.timetable.movedLessons.delete
  .use(requireAuthorization(permissions.movedLessonDelete))
  .handler(async ({ context, input }) => {
    const { id } = input;

    const [deletedMovedLesson] = await db
      .delete(movedLesson)
      .where(eq(movedLesson.id, id))
      .returning();

    if (!deletedMovedLesson) {
      throw notFound('Moved lesson not found');
    }

    await recordActivity(context, {
      action: 'delete',
      entityId: id,
      entityType: 'movedLesson',
    });

    cancelPendingNotification(id, 'moved_lesson');

    return { id: deletedMovedLesson.id };
  });
