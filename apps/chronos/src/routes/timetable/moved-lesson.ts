import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '#database';
import {
  classroom,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  movedLesson,
  movedLessonLessonMTM,
  period,
} from '#database/schema/timetable';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { badRequest, notFound } from '#utils/http';
import {
  cancelPendingNotification,
  dispatchPendingNotification,
} from '#utils/notifications/engine';
import { getActiveTimetableId } from '#utils/timetable/active';
import {
  type EnrichedLesson,
  enrichLessons,
} from '#utils/timetable/enrich-lessons';

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
  const enriched = await enrichLessons(allLessonIds);
  const lessonMap = new Map(enriched.map((l) => [l.id, l]));

  return rows.map((r) => ({
    classroom: r.classroom,
    dayDefinition: r.dayDefinition,
    lessons: r.lessons
      .map((id) => lessonMap.get(id))
      .filter((l): l is EnrichedLesson => l !== undefined),
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

    return await attachEnrichedLessons(movedLessons);
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

    return await attachEnrichedLessons(movedLessons);
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

    return await attachEnrichedLessons(movedLessons);
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

    return await attachEnrichedLessons(movedLessons);
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

    const [newMovedLesson] = await db
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

    if (
      lessonIds &&
      Array.isArray(lessonIds) &&
      lessonIds.length > 0 &&
      newMovedLesson
    ) {
      await db.insert(movedLessonLessonMTM).values(
        lessonIds.map((lessonId: string) => ({
          lessonId,
          movedLessonId: newMovedLesson.id,
        }))
      );
    }

    if (newMovedLesson) {
      dispatchPendingNotification(newMovedLesson.id, 'moved_lesson', {
        date: body.date,
        lessonIds: lessonIds ?? [],
        room,
        startingDay,
        startingPeriod,
      });
    }

    if (!newMovedLesson) {
      throw new ORPCError('INTERNAL', {
        cause:
          env.mode === 'development'
            ? 'No moved lesson returned from insert query'
            : undefined,
        message: 'Failed to create moved lesson.',
      });
    }

    return newMovedLesson;
  });

export const updateMovedLesson = base.timetable.movedLessons.update
  .use(requireAuthorization(permissions.movedLessonUpdate))
  .handler(async ({ input }) => {
    const { id } = input;
    const { startingPeriod, startingDay, room, date, lessonIds, comment } =
      input;

    await validateMovedLessonReferences({
      lessonIds,
      room,
      startingDay,
      startingPeriod,
    });

    cancelPendingNotification(id, 'moved_lesson');

    const [updatedMovedLesson] = await db
      .update(movedLesson)
      .set({
        comment: comment === undefined ? undefined : comment,
        date,
        room: room === undefined ? undefined : room,
        startingDay: startingDay === undefined ? undefined : startingDay,
        startingPeriod:
          startingPeriod === undefined ? undefined : startingPeriod,
      })
      .where(eq(movedLesson.id, id))
      .returning();

    if (!updatedMovedLesson) {
      throw notFound('Moved lesson not found');
    }

    if (lessonIds !== undefined && Array.isArray(lessonIds)) {
      await db
        .delete(movedLessonLessonMTM)
        .where(eq(movedLessonLessonMTM.movedLessonId, id));

      if (lessonIds.length > 0) {
        await db.insert(movedLessonLessonMTM).values(
          lessonIds.map((lessonId: string) => ({
            lessonId,
            movedLessonId: id,
          }))
        );
      }
    }

    dispatchPendingNotification(id, 'moved_lesson', {
      date,
      lessonIds: lessonIds ?? [],
      room,
      startingDay,
      startingPeriod,
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
