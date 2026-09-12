import {
  createClassroomSchema,
  updateClassroomSchema,
} from '@filcdev/api/domains/navigator/classroom';
import { idParamSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorClassroom } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { created, internalServerError, notFound, ok } from '#utils/http';
import { pickDefined } from '#utils/navigator/pick-defined';
import {
  classroomResponseSchema,
  classroomsResponseSchema,
} from '#utils/navigator/schemas';
import {
  assertClassroomNameUnique,
  conflictOnUniqueViolation,
} from '#utils/navigator/uniqueness';
import { filcExt } from '#utils/openapi';
import { navigatorFactory, navigatorIdPathParam } from './_factory';

const { schema: createClassroomRequestSchema } = await resolver(
  createClassroomSchema
).toOpenAPISchema();
const { schema: updateClassroomRequestSchema } = await resolver(
  updateClassroomSchema
).toOpenAPISchema();

export const listClassroomsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit ClassroomListResponse @field(.classrooms, List<Classroom>)',
      true
    ),
    description: 'List all navigator classrooms',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(classroomsResponseSchema),
          },
        },
        description: 'List of classrooms',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  async (c) => {
    const classrooms = await db
      .select()
      .from(navigatorClassroom)
      .orderBy(
        asc(navigatorClassroom.name),
        asc(navigatorClassroom.buildingId)
      );

    return ok(c, { classrooms });
  }
);

export const createClassroomRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit ClassroomResponse @field(.classroom, Classroom)',
      true
    ),
    description: 'Create a new navigator classroom',
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
      409: {
        description:
          'A classroom with this name already exists in this building',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createClassroomSchema),
  async (c) => {
    const payload = c.req.valid('json');

    await assertClassroomNameUnique(db, payload.name, payload.buildingId);

    try {
      const [inserted] = await db
        .insert(navigatorClassroom)
        .values(payload)
        .returning();

      if (!inserted) {
        throw internalServerError('Failed to create classroom');
      }

      return created(c, { classroom: inserted });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A classroom with this name already exists in this building'
      );
    }
  }
);

export const updateClassroomRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit ClassroomResponse @field(.classroom, Classroom)',
      true
    ),
    description: 'Update a navigator classroom',
    parameters: [navigatorIdPathParam],
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
      404: { description: 'Classroom not found' },
      409: {
        description:
          'A classroom with this name already exists in this building',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateClassroomSchema),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(navigatorClassroom)
      .where(eq(navigatorClassroom.id, id));

    if (!existing) {
      throw notFound('Classroom not found');
    }

    const name = payload.name ?? existing.name;
    const buildingId = payload.buildingId ?? existing.buildingId;

    if (payload.name !== undefined || payload.buildingId !== undefined) {
      await assertClassroomNameUnique(db, name, buildingId, id);
    }

    const set = pickDefined(payload);
    if (Object.keys(set).length === 0) {
      return ok(c, { classroom: existing });
    }

    try {
      const [updated] = await db
        .update(navigatorClassroom)
        .set(set)
        .where(eq(navigatorClassroom.id, id))
        .returning();

      if (!updated) {
        throw notFound('Classroom not found');
      }

      return ok(c, { classroom: updated });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A classroom with this name already exists in this building'
      );
    }
  }
);

export const deleteClassroomRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@nodata', true),
    description: 'Delete a navigator classroom',
    parameters: [navigatorIdPathParam],
    responses: {
      200: { description: 'Classroom deleted' },
      404: { description: 'Classroom not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(navigatorClassroom)
      .where(eq(navigatorClassroom.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Classroom not found');
    }

    return ok(c, undefined);
  }
);
