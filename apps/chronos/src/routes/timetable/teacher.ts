import {
  getTeacherParamsSchema,
  listTeachersResponseSchema,
  type TeacherListItem,
  teacherListItemSchema,
  updateTeacherPayload,
} from '@filcdev/api/domains/timetable/teacher';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { teacher } from '#database/schema/timetable';
import { authRouter } from '#middleware/auth';
import { badRequest, notFound, ok } from '#utils/http';
import { filcExt } from '#utils/openapi';
import { timetableFactory } from './_factory';

const publicTeacherSchema = z.object({
  firstName: z.string(),
  id: z.string(),
  lastName: z.string(),
  short: z.string(),
});

const getTeachersResponseSchema = z.object({
  data: publicTeacherSchema.array(),
  success: z.boolean(),
});

const updateTeacherBodySchema = (
  await resolver(updateTeacherPayload).toOpenAPISchema()
).schema;

const updateTeacherResponseSchema = z.object({
  data: teacherListItemSchema,
  success: z.boolean(),
});

/**
 * Public teacher list used by the timetable filter bars and substitution
 * pickers. Projects only non-sensitive columns; email and the linked user stay
 * behind the admin endpoints.
 */
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
    const teachers = await db
      .select({
        firstName: teacher.firstName,
        id: teacher.id,
        lastName: teacher.lastName,
        short: teacher.short,
      })
      .from(teacher);

    return ok(c, teachers);
  }
);

/** Admin teacher list, including email and the linked user account. */
export const listTeachersAdmin = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Teacher', '@listof @unit TeacherListItem', true),
    description: 'List all teachers with their email and linked user.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(listTeachersResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Teacher'],
  }),
  ...authRouter(permissions.teacherManage),
  async (c) => {
    const rows = await db
      .select({
        email: teacher.email,
        firstName: teacher.firstName,
        id: teacher.id,
        lastName: teacher.lastName,
        short: teacher.short,
        userEmail: user.email,
        userId: teacher.userId,
        userName: user.name,
      })
      .from(teacher)
      .leftJoin(user, eq(user.id, teacher.userId));

    const data: TeacherListItem[] = rows.map((row) => ({
      email: row.email,
      firstName: row.firstName,
      id: row.id,
      lastName: row.lastName,
      short: row.short,
      user: row.userId
        ? {
            email: row.userEmail ?? '',
            id: row.userId,
            name: row.userName ?? '',
          }
        : null,
      userId: row.userId,
    }));

    return ok(c, data);
  }
);

/** Manually set a teacher's email and/or linked user. */
export const updateTeacher = timetableFactory.createHandlers(
  describeRoute({
    ...filcExt('Teacher', '@unit TeacherListItem', true),
    description: 'Update a teacher email and/or linked user.',
    parameters: [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {
          format: 'uuid',
          type: 'string',
        },
      },
    ],
    requestBody: {
      content: {
        'application/json': {
          schema: updateTeacherBodySchema,
        },
      },
      required: true,
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(updateTeacherResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Teacher'],
  }),
  ...authRouter(permissions.teacherManage),
  zValidator('param', getTeacherParamsSchema),
  zValidator('json', updateTeacherPayload),
  async (c) => {
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');

    const [existing] = await db
      .select({ id: teacher.id })
      .from(teacher)
      .where(eq(teacher.id, id))
      .limit(1);
    if (!existing) {
      throw notFound('Teacher not found');
    }

    if (body.userId !== undefined && body.userId !== null) {
      const [linkedUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, body.userId))
        .limit(1);
      if (!linkedUser) {
        throw badRequest('The linked user does not exist');
      }
    }

    let email: string | null | undefined;
    if (body.email === undefined) {
      email = undefined;
    } else if (body.email === null) {
      email = null;
    } else {
      email = body.email.toLowerCase();
    }

    await db
      .update(teacher)
      .set({
        email,
        userId: body.userId,
      })
      .where(eq(teacher.id, id));

    const [updated] = await db
      .select({
        email: teacher.email,
        firstName: teacher.firstName,
        id: teacher.id,
        lastName: teacher.lastName,
        short: teacher.short,
        userEmail: user.email,
        userId: teacher.userId,
        userName: user.name,
      })
      .from(teacher)
      .leftJoin(user, eq(user.id, teacher.userId))
      .where(eq(teacher.id, id))
      .limit(1);

    if (!updated) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Teacher not found',
      });
    }

    const data: TeacherListItem = {
      email: updated.email,
      firstName: updated.firstName,
      id: updated.id,
      lastName: updated.lastName,
      short: updated.short,
      user: updated.userId
        ? {
            email: updated.userEmail ?? '',
            id: updated.userId,
            name: updated.userName ?? '',
          }
        : null,
      userId: updated.userId,
    };

    return ok(c, data);
  }
);
