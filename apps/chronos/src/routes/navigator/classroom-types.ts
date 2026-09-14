import {
  createClassroomTypeSchema,
  updateClassroomTypeSchema,
} from '@filcdev/api/domains/navigator/classroom-type';
import { navigatorIdParamsSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { classroomType as classroomTypeTable } from '#database/schema/timetable';
import { authRouter } from '#middleware/auth';
import { navigatorFactory } from '#routes/navigator/_factory';
import { conflict, created, notFound, ok } from '#utils/http';
import { isReferencedRowError } from '#utils/navigator/errors';
import {
  classroomTypeResponseSchema,
  classroomTypesResponseSchema,
} from '#utils/navigator/schemas';
import { filcExt } from '#utils/openapi';

const { schema: createClassroomTypeRequestSchema } = await resolver(
  createClassroomTypeSchema
).toOpenAPISchema();
const { schema: updateClassroomTypeRequestSchema } = await resolver(
  updateClassroomTypeSchema
).toOpenAPISchema();

export const listClassroomTypesRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@listof ClassroomType'),
    description: 'List the classroom types',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(classroomTypesResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
  async (c) => {
    const classroomTypes = await db
      .select()
      .from(classroomTypeTable)
      .orderBy(asc(classroomTypeTable.name));

    return ok(c, { classroom_types: classroomTypes });
  }
);

export const createClassroomTypeRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit ClassroomType', true),
    description: 'Create a classroom type',
    requestBody: {
      content: {
        'application/json': {
          schema: createClassroomTypeRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(classroomTypeResponseSchema),
          },
        },
        description: 'Classroom type created',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createClassroomTypeSchema),
  async (c) => {
    const payload = c.req.valid('json');

    const [classroomType] = await db
      .insert(classroomTypeTable)
      .values({ id: crypto.randomUUID(), ...payload })
      .returning();

    return created(c, { classroom_type: classroomType });
  }
);

export const updateClassroomTypeRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit ClassroomType', true),
    description: 'Update a classroom type',
    requestBody: {
      content: {
        'application/json': {
          schema: updateClassroomTypeRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(classroomTypeResponseSchema),
          },
        },
        description: 'Classroom type updated',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Classroom type not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateClassroomTypeSchema),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    // An empty patch is a legal (if pointless) request, and Drizzle refuses to
    // build an `update … set` with no values.
    const [classroomType] =
      Object.keys(payload).length > 0
        ? await db
            .update(classroomTypeTable)
            .set(payload)
            .where(eq(classroomTypeTable.id, id))
            .returning()
        : await db
            .select()
            .from(classroomTypeTable)
            .where(eq(classroomTypeTable.id, id));

    if (!classroomType) {
      throw notFound('Classroom type not found');
    }

    return ok(c, { classroom_type: classroomType });
  }
);

export const deleteClassroomTypeRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit ClassroomType', true),
    description:
      'Delete a classroom type; types still assigned to a classroom are refused',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(classroomTypeResponseSchema),
          },
        },
        description: 'Classroom type deleted',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Classroom type not found' },
      409: { description: 'Classroom type is still used by a classroom' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    try {
      const [classroomType] = await db
        .delete(classroomTypeTable)
        .where(eq(classroomTypeTable.id, id))
        .returning();

      if (!classroomType) {
        throw notFound('Classroom type not found');
      }

      return ok(c, { classroom_type: classroomType });
    } catch (error) {
      // The FK is RESTRICT, so the database is the authority on whether the
      // type is still referenced: translating its error avoids a pre-check
      // query that would race a concurrent insert.
      if (isReferencedRowError(error)) {
        throw conflict('Classroom type is still used by a classroom', error);
      }
      throw error;
    }
  }
);
