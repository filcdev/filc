import { createSelectSchema } from 'drizzle-zod';
import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { teacher } from '#database/schema/timetable';
import { ensureJsonSafeDates } from '#utils/zod';
import { timetableFactory } from '../_factory';

const getTeachersResponseSchema = z.object({
  data: ensureJsonSafeDates(createSelectSchema(teacher)).array(),
  success: z.boolean(),
});

export const getTeachers = timetableFactory.createHandlers(
  describeRoute({
    description: 'Get all teachers from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(getTeachersResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Teacher'],
  }),
  async (c) => {
    const teachers = await db.select().from(teacher);

    return c.json<SuccessResponse<typeof teachers>>({
      data: teachers,
      success: true,
    });
  }
);
