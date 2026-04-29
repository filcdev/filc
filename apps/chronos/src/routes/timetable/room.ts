import { zValidator } from '@hono/zod-validator';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import {
  classroom,
  lesson,
  movedLesson,
  movedLessonLessonMTM,
} from '#database/schema/timetable';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';
import { timetableFactory } from './_factory';

const getClassroomsResponseSchema = z.object({
  data: createSelectSchema(classroom, {
    buildingId: z.string().nullable(),
  }).array(),
  success: z.boolean(),
});

const getAvailableClassroomsResponseSchema = z.object({
  data: createSelectSchema(classroom, {
    buildingId: z.string().nullable(),
  }).array(),
  success: z.boolean(),
});

const getAvailableClassroomsQuerySchema = z.object({
  date: z.coerce.date(),
  startingDay: z.string().uuid(),
  startingPeriod: z.string().uuid(),
  timetableId: z.string().uuid().optional(),
});

export const getClassrooms = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Classroom', '@listof Classroom'),
    description: 'Get all classrooms from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getClassroomsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Classroom'],
  }),
  async (c) => {
    const classrooms = await db.select().from(classroom);
    return c.json<SuccessResponse<typeof classrooms>>({
      data: classrooms,
      success: true,
    });
  }
);

export const getAvailableClassrooms = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Classroom', '@listof Classroom'),
    description:
      'Get classrooms that are free for a given date, day and period.',
    parameters: [
      {
        in: 'query',
        name: 'date',
        required: true,
        schema: {
          description: 'The exact date to check for available classrooms.',
          format: 'date',
          type: 'string',
        },
      },
      {
        in: 'query',
        name: 'startingDay',
        required: true,
        schema: {
          description: 'The day definition id for the target slot.',
          type: 'string',
        },
      },
      {
        in: 'query',
        name: 'startingPeriod',
        required: true,
        schema: {
          description: 'The period id for the target slot.',
          type: 'string',
        },
      },
      {
        in: 'query',
        name: 'timetableId',
        required: false,
        schema: {
          description:
            'Optional timetable id to limit the search to a specific timetable.',
          type: 'string',
        },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getAvailableClassroomsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Classroom'],
  }),
  zValidator('query', getAvailableClassroomsQuerySchema),
  async (c) => {
    const { date, startingDay, startingPeriod, timetableId } =
      c.req.valid('query');

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

    return c.json<SuccessResponse<typeof availableClassrooms>>({
      data: availableClassrooms,
      success: true,
    });
  }
);
