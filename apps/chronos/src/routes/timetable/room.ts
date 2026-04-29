import { and, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { zValidator } from '@hono/zod-validator';
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
          type: 'string',
          format: 'date',
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

    const movedLessonRows = await db
      .select({ lessonId: movedLessonLessonMTM.lessonId, roomId: movedLesson.room })
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
      );

    const movedLessonIds = new Set(
      movedLessonRows.map((row) => row.lessonId).filter(Boolean)
    );
    const occupiedRooms = new Set(
      movedLessonRows
        .map((row) => row.roomId)
        .filter((roomId): roomId is string => Boolean(roomId))
    );

    const lessonQuery = timetableId
      ? db
          .select({ id: lesson.id, classroomIds: lesson.classroomIds })
          .from(lesson)
          .where(
            and(
              eq(lesson.dayDefinitionId, startingDay),
              eq(lesson.periodId, startingPeriod),
              eq(lesson.timetableId, timetableId)
            )
          )
      : db
          .select({ id: lesson.id, classroomIds: lesson.classroomIds })
          .from(lesson)
          .where(
            and(
              eq(lesson.dayDefinitionId, startingDay),
              eq(lesson.periodId, startingPeriod)
            )
          );

    const lessonRows = await lessonQuery;

    for (const row of lessonRows) {
      if (movedLessonIds.has(row.id)) {
        continue;
      }

      if (Array.isArray(row.classroomIds)) {
        for (const roomId of row.classroomIds) {
          if (roomId) {
            occupiedRooms.add(roomId);
          }
        }
      }
    }

    const classrooms = await db.select().from(classroom);
    const availableClassrooms = classrooms.filter(
      (room) => !occupiedRooms.has(room.id)
    );

    return c.json<SuccessResponse<typeof availableClassrooms>>({
      data: availableClassrooms,
      success: true,
    });
  }
);
