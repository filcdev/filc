import { describeRoute, resolver } from 'hono-openapi';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { db } from '#database';
import { teacher } from '#database/schema/timetable';
import { filcExt } from '#utils/openapi';
import { createSelectSchema } from '#utils/zod';
import { timetableFactory } from './_factory';

const getTeachersResponseSchema = z.object({
  data: createSelectSchema(teacher).array(),
  success: z.boolean(),
});

export const getTeachers = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Teacher', '@listof Teacher'),
    description: 'Get all teachers from the database.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(getTeachersResponseSchema),
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
