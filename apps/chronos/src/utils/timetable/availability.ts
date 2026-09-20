import { and, eq, notInArray, sql } from 'drizzle-orm';
import {
  lesson,
  movedLesson,
  movedLessonLessonMTM,
} from '#database/schema/timetable';
import type { TxOrDb } from '#utils/timetable/manual-lesson';

/**
 * Classroom ids occupied for a given target slot (date + day + period). A room
 * is occupied when a moved lesson targets it for the slot, or a non-moved
 * lesson is scheduled in it for the same day and period. This is the single
 * source of truth for room availability: the `getAvailable` endpoint and the
 * manual create handler both call it so their notions of "occupied" never
 * drift.
 */
export async function getOccupiedClassroomIds(
  executor: TxOrDb,
  params: {
    date: Date;
    startingDay: string;
    startingPeriod: string;
    timetableId?: string | null | undefined;
  }
): Promise<string[]> {
  const { date, startingDay, startingPeriod, timetableId } = params;

  const [movedLessonRooms, lessonRooms] = await Promise.all([
    // Rooms taken by moved lessons targeting the slot.
    executor
      .select({ roomId: movedLesson.room })
      .from(movedLesson)
      .where(
        and(
          eq(movedLesson.date, date),
          eq(movedLesson.startingDay, startingDay),
          eq(movedLesson.startingPeriod, startingPeriod),
          sql`${movedLesson.room} IS NOT NULL`
        )
      ),
    // Rooms taken by lessons scheduled in the slot, excluding lessons that are
    // themselves moved into it (those are accounted for by the moved-lesson
    // check above).
    executor
      .select({ roomId: sql<string>`unnest(${lesson.classroomIds})` })
      .from(lesson)
      .where(
        and(
          eq(lesson.dayDefinitionId, startingDay),
          eq(lesson.periodId, startingPeriod),
          timetableId ? eq(lesson.timetableId, timetableId) : undefined,
          notInArray(
            lesson.id,
            executor
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
      ),
  ]);

  const occupied = new Set<string>();
  for (const { roomId } of movedLessonRooms) {
    if (roomId) {
      occupied.add(roomId);
    }
  }
  for (const { roomId } of lessonRooms) {
    occupied.add(roomId);
  }
  return [...occupied];
}
