import { and, eq, notInArray, sql } from 'drizzle-orm';
import { db } from '#database';
import {
  classroom,
  lesson,
  movedLesson,
  movedLessonLessonMTM,
} from '#database/schema/timetable';
import { base } from '#orpc';

export const getClassrooms = base.timetable.classrooms.getAll.handler(
  async () => {
    const classrooms = await db.select().from(classroom);
    return classrooms;
  }
);

export const getAvailableClassrooms =
  base.timetable.classrooms.getAvailable.handler(async ({ input }) => {
    const { date, startingDay, startingPeriod, timetableId } = input;

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
                  timetableId ? eq(lesson.timetableId, timetableId) : undefined,
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

    return availableClassrooms;
  });
