import { getAvailableClassroomsQuerySchema } from '@filcdev/api/domains/timetable/room';
import { zValidator } from '@hono/zod-validator';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import { db } from '#database';
import { classroom } from '#database/schema/timetable';
import { ok } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { getOccupiedClassroomIds } from '#utils/timetable/availability';
import { createSelectSchema } from '#utils/zod';
import { timetableFactory } from './_factory';

const getClassroomsResponseSchema = z.object({
  data: createSelectSchema(classroom, {
    building_id: z.string().nullable(),
  }).array(),
  success: z.boolean(),
});

const getAvailableClassroomsResponseSchema = z.object({
  data: createSelectSchema(classroom, {
    building_id: z.string().nullable(),
  }).array(),
  success: z.boolean(),
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
    return ok(c, classrooms);
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

    const occupiedRoomIds = await getOccupiedClassroomIds(db, {
      date,
      startingDay,
      startingPeriod,
      timetableId,
    });
    const occupied = new Set(occupiedRoomIds);

    const classrooms = await db.select().from(classroom);
    return ok(
      c,
      classrooms.filter((room) => !occupied.has(room.id))
    );
  }
);
