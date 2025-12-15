import { createSelectSchema } from 'drizzle-zod';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import { db } from '#database';
import { classroom } from '#database/schema/timetable';
import type { SuccessResponse } from '#utils/globals';
import { ensureJsonSafeDates } from '#utils/zod';
import { timetableFactory } from '../_factory';

const getClassroomsResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(classroom)).array(),
  success: z.boolean(),
});

export const getClassrooms = timetableFactory.createHandlers(
  describeRoute({
    description: 'Get all classrooms from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(getClassroomsResponseSchema)),
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
