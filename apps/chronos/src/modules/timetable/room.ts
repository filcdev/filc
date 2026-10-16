import { and, eq, notInArray, sql } from 'drizzle-orm';
import { db } from '#database';
import {
  classroom,
  lesson,
  movedLesson,
  movedLessonLessonMTM,
} from '#modules/timetable/schema';
import { getTimetableIdForDate } from '#modules/timetable/utils/active';
import { base } from '#orpc';

/**
 * Legacy room rows carry an empty `short` and duplicate a room that has one, so
 * they surface twice in the room pickers: drop them, and give the remaining
 * short-less rooms the `A.123` spelling the rest of the data uses.
 */
const normalizeRoomKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

const legacyRoomNamePattern = /^([a-z])(\d{3})$/i;

function removeLegacyRoomDuplicates(
  classrooms: (typeof classroom.$inferSelect)[]
) {
  const canonicalKeys = new Set(
    classrooms
      .map((room) => room.short.trim())
      .filter(Boolean)
      .map(normalizeRoomKey)
  );

  return classrooms
    .filter(
      (room) =>
        room.short.trim() !== '' ||
        !canonicalKeys.has(normalizeRoomKey(room.name))
    )
    .map((room) => {
      if (room.short.trim() !== '') {
        return room;
      }

      const match = legacyRoomNamePattern.exec(room.name.trim());
      return match
        ? { ...room, name: `${match[1]?.toUpperCase()}.${match[2]}` }
        : room;
    });
}

export const getClassrooms = base.timetable.classrooms.getAll.handler(
  async () => {
    const classrooms = await db.select().from(classroom);
    return { items: classrooms, total: classrooms.length };
  }
);

export const getAvailableClassrooms =
  base.timetable.classrooms.getAvailable.handler(async ({ input }) => {
    const { date, startingDay, startingPeriod, timetableId } = input;

    // A request without an explicit timetable falls back to the one that owns
    // the requested date. When neither resolves, no lesson may count as
    // occupying a room — filtering by nothing would mark every room busy.
    const effectiveTimetableId =
      timetableId ?? (await getTimetableIdForDate(date));

    // Get available classrooms in one query
    const availableClassrooms = await db
      .select()
      .from(classroom)
      .where(
        and(
          // Not occupied by moved lessons
          notInArray(
            classroom.id,
            db
              .select({ roomId: movedLesson.room })
              .from(movedLesson)
              .where(
                and(
                  eq(movedLesson.date, date),
                  eq(movedLesson.startingDay, startingDay),
                  eq(movedLesson.startingPeriod, startingPeriod),
                  sql`${movedLesson.room} IS NOT NULL`
                )
              )
          ),
          // Not occupied by lessons (excluding moved ones)
          notInArray(
            classroom.id,
            db
              .select({ roomId: sql<string>`unnest(${lesson.classroomIds})` })
              .from(lesson)
              .where(
                and(
                  eq(lesson.dayDefinitionId, startingDay),
                  eq(lesson.periodId, startingPeriod),
                  effectiveTimetableId
                    ? eq(lesson.timetableId, effectiveTimetableId)
                    : sql`false`,
                  notInArray(
                    lesson.id,
                    db
                      .select({ lessonId: movedLessonLessonMTM.lessonId })
                      .from(movedLesson)
                      .innerJoin(
                        movedLessonLessonMTM,
                        eq(movedLesson.id, movedLessonLessonMTM.movedLessonId)
                      )
                      .where(
                        and(
                          eq(movedLesson.date, date),
                          eq(movedLesson.startingDay, startingDay),
                          eq(movedLesson.startingPeriod, startingPeriod)
                        )
                      )
                  )
                )
              )
          )
        )
      );

    const items = removeLegacyRoomDuplicates(availableClassrooms);
    return { items, total: items.length };
  });
