import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { classroom } from '#database/schema/timetable';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';
import { timetableFactory } from './_factory';

const getClassroomsResponseSchema = z.object({
  data: createSelectSchema(classroom, {
    buildingId: z.string().nullable(),
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
    return c.json<SuccessResponse<typeof classrooms>>({
      data: classrooms,
      success: true,
    });
  }
);
