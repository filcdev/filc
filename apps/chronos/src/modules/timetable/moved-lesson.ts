import type { Lesson } from '@filcdev/api/domains/timetable/lesson';
import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import {
  classroom,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  movedLesson,
  movedLessonLessonMTM,
  period,
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
}) => {
  const { startingPeriod, startingDay, room, lessonIds } = options;

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
};

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

// Enrich the linked lesson ids of a batch of moved-lesson rows, preserving the
// target joins and the per-moved-lesson lesson order. A moved lesson keeps
// pointing at the lesson it was created for, even after that lesson's timetable
// is retired, so this must not be scoped to the active timetable.
async function attachEnrichedLessons(rows: MovedLessonRow[]) {
  const allLessonIds = Array.from(new Set(rows.flatMap((r) => r.lessons)));
  const enriched = await enrichLessons(await loadLessonsByIds(allLessonIds));
  const lessonMap = new Map(enriched.map((l) => [l.id, l]));

  return rows.map((r) => ({
    classroom: r.classroom,
    dayDefinition: r.dayDefinition,
    lessons: r.lessons
      .map((id) => lessonMap.get(id))
      .filter((l): l is Lesson => l !== undefined),
    movedLesson: r.movedLesson,
    period: r.period,
  }));
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
      .where(eq(lessonCohortMTM.cohortId, cohortId))
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
          eq(lessonCohortMTM.cohortId, cohortId),
          gte(movedLesson.date, today)
        )
      )
      .groupBy(movedLesson.id, period.id, dayDefinition.id, classroom.id);

    const items = await attachEnrichedLessons(movedLessons);
    return { items, total: items.length };
  });

export const createMovedLesson = base.timetable.movedLessons.create
  .use(requireAuthorization(permissions.movedLessonCreate))
  .handler(async ({ input }) => {
    const body = input;
    const { startingPeriod, startingDay, room, date, lessonIds, comment } =
      body;

    if (!date) {
      throw badRequest('Date is required');
    }

    await validateMovedLessonReferences({
      lessonIds,
      room,
      startingDay,
      startingPeriod,
    });

    // Row and lesson links are one unit: a failure between them leaves a moved
    // lesson with no lessons, which nothing downstream can repair.
    const newMovedLesson = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(movedLesson)
        .values({
          comment,
          date,
          id: crypto.randomUUID(),
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

      if (lessonIds && lessonIds.length > 0) {
        await tx.insert(movedLessonLessonMTM).values(
          lessonIds.map((lessonId: string) => ({
            lessonId,
            movedLessonId: row.id,
          }))
        );
      }

      return row;
    });

    dispatchPendingNotification(newMovedLesson.id, 'moved_lesson', {
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
  .handler(async ({ input }) => {
    const { id, lessonIds, ...columns } = input;

    await validateMovedLessonReferences({ ...columns, lessonIds });

    cancelPendingNotification(id, 'moved_lesson');

    // The row and its lesson links are one unit: a failure between them would
    // leave a moved lesson attached to the wrong lessons. Both writes go in one
    // transaction, and the row is read back so an empty patch still 404s.
    const updatedMovedLesson = await db.transaction(async (tx) => {
      const [row] =
        Object.keys(columns).length > 0
          ? await tx
              .update(movedLesson)
              .set(columns)
              .where(eq(movedLesson.id, id))
              .returning()
          : await tx.select().from(movedLesson).where(eq(movedLesson.id, id));

      if (!row) {
        throw notFound('Moved lesson not found');
      }

      if (lessonIds !== undefined) {
        await tx
          .delete(movedLessonLessonMTM)
          .where(eq(movedLessonLessonMTM.movedLessonId, id));

        if (lessonIds.length > 0) {
          await tx.insert(movedLessonLessonMTM).values(
            lessonIds.map((lessonId: string) => ({
              lessonId,
              movedLessonId: id,
            }))
          );
        }
      }

      return row;
    });

    // A partial patch must not notify an empty audience, so the payload is the
    // merged result rather than just what the caller sent.
    const effectiveLessonIds =
      lessonIds ??
      (
        await db
          .select({ lessonId: movedLessonLessonMTM.lessonId })
          .from(movedLessonLessonMTM)
          .where(eq(movedLessonLessonMTM.movedLessonId, id))
      ).map(({ lessonId }) => lessonId);

    dispatchPendingNotification(id, 'moved_lesson', {
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
  .handler(async ({ input }) => {
    const { id } = input;

    const [deletedMovedLesson] = await db
      .delete(movedLesson)
      .where(eq(movedLesson.id, id))
      .returning();

    if (!deletedMovedLesson) {
      throw notFound('Moved lesson not found');
    }

    cancelPendingNotification(id, 'moved_lesson');

    return { id: deletedMovedLesson.id };
  });
