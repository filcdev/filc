import {
  createClassroomSchema,
  updateClassroomSchema,
} from '@filcdev/api/domains/navigator/classroom';
import { navigatorIdParamsSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq, sql } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import {
  classroom as classroomTable,
  cohort,
  lesson,
  movedLesson,
} from '#database/schema/timetable';
import { authRouter } from '#middleware/auth';
import { navigatorFactory } from '#routes/navigator/_factory';
import { conflict, created, notFound, ok } from '#utils/http';
import {
  classroomResponseSchema,
  classroomsResponseSchema,
} from '#utils/navigator/schemas';
import { filcExt } from '#utils/openapi';

const { schema: createClassroomRequestSchema } = await resolver(
  createClassroomSchema
).toOpenAPISchema();
const { schema: updateClassroomRequestSchema } = await resolver(
  updateClassroomSchema
).toOpenAPISchema();

export const listClassroomsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@listof Classroom'),
    description:
      'List the classrooms, including the ones the campus has not placed yet',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(classroomsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
  async (c) => {
    const classrooms = await db
      .select()
      .from(classroomTable)
      .orderBy(asc(classroomTable.name));

    return ok(c, { classrooms });
  }
);

export const createClassroomRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Classroom', true),
    description: 'Create a classroom',
    requestBody: {
      content: {
        'application/json': {
          schema: createClassroomRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(classroomResponseSchema),
          },
        },
        description: 'Classroom created',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createClassroomSchema),
  async (c) => {
    const payload = c.req.valid('json');

    const [classroom] = await db
      .insert(classroomTable)
      .values({ id: crypto.randomUUID(), mapped: true, ...payload })
      .returning();

    return created(c, { classroom });
  }
);

export const updateClassroomRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Classroom', true),
    description: 'Update a classroom',
    requestBody: {
      content: {
        'application/json': {
          schema: updateClassroomRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(classroomResponseSchema),
          },
        },
        description: 'Classroom updated',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Classroom not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateClassroomSchema),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    // An empty patch is a legal (if pointless) request, and Drizzle refuses to
    // build an `update … set` with no values. A campus save is an admin
    // placing the room, so it is mapped from then on.
    const [classroom] =
      Object.keys(payload).length > 0
        ? await db
            .update(classroomTable)
            .set({ ...payload, mapped: true })
            .where(eq(classroomTable.id, id))
            .returning()
        : await db
            .select()
            .from(classroomTable)
            .where(eq(classroomTable.id, id));

    if (!classroom) {
      throw notFound('Classroom not found');
    }

    return ok(c, { classroom });
  }
);

export const deleteClassroomRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Classroom', true),
    description:
      'Delete a classroom; rooms the timetable still uses are refused',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(classroomResponseSchema),
          },
        },
        description: 'Classroom deleted',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Classroom not found' },
      409: { description: 'The timetable still uses the classroom' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    // The room rows are the timetable's too, and nothing in the timetable
    // cascades: refuse the delete while any of its own rows still points here,
    // naming the table that blocks it.
    const [moved, scheduled, registered] = await Promise.all([
      db
        .select({ id: movedLesson.id })
        .from(movedLesson)
        .where(eq(movedLesson.room, id))
        .limit(1),
      db
        .select({ id: lesson.id })
        .from(lesson)
        .where(sql`${id} = ANY(${lesson.classroomIds})`)
        .limit(1),
      db
        .select({ id: cohort.id })
        .from(cohort)
        .where(sql`${id} = ANY(${cohort.classroomIds})`)
        .limit(1),
    ]);

    if (moved.length > 0) {
      throw conflict('A moved lesson points at this room');
    }
    if (scheduled.length > 0) {
      throw conflict('Lessons are scheduled in this room');
    }
    if (registered.length > 0) {
      throw conflict('A class is registered to this room');
    }

    const [classroom] = await db
      .delete(classroomTable)
      .where(eq(classroomTable.id, id))
      .returning();

    if (!classroom) {
      throw notFound('Classroom not found');
    }

    return ok(c, { classroom });
  }
);
