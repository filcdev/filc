import {
  createClassroomTypeSchema,
  updateClassroomTypeSchema,
} from '@filcdev/api/domains/navigator/classroom-type';
import { idParamSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorClassroomType } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { created, internalServerError, notFound, ok } from '#utils/http';
import {
  classroomTypeResponseSchema,
  classroomTypesResponseSchema,
} from '#utils/navigator/schemas';
import {
  assertClassroomTypeNameUnique,
  conflictOnUniqueViolation,
} from '#utils/navigator/uniqueness';
import { filcExt } from '#utils/openapi';
import { navigatorFactory, navigatorIdPathParam } from './_factory';

const { schema: createClassroomTypeRequestSchema } = await resolver(
  createClassroomTypeSchema
).toOpenAPISchema();
const { schema: updateClassroomTypeRequestSchema } = await resolver(
  updateClassroomTypeSchema
).toOpenAPISchema();

export const listClassroomTypesRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit ClassroomTypeListResponse @field(.classroomTypes, List<ClassroomType>)',
      true
    ),
    description: 'List all navigator classroom types',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(classroomTypesResponseSchema),
          },
        },
        description: 'List of classroom types',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  async (c) => {
    const classroomTypes = await db
      .select()
      .from(navigatorClassroomType)
      .orderBy(asc(navigatorClassroomType.name));

    return ok(c, { classroomTypes });
  }
);

export const createClassroomTypeRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit ClassroomTypeResponse @field(.classroomType, ClassroomType)',
      true
    ),
    description: 'Create a new navigator classroom type',
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
      409: { description: 'A classroom type with this name already exists' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createClassroomTypeSchema),
  async (c) => {
    const payload = c.req.valid('json');

    await assertClassroomTypeNameUnique(db, payload.name);

    try {
      const [inserted] = await db
        .insert(navigatorClassroomType)
        .values({ colorhex: payload.colorhex ?? null, name: payload.name })
        .returning();

      if (!inserted) {
        throw internalServerError('Failed to create classroom type');
      }

      return created(c, { classroomType: inserted });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A classroom type with this name already exists'
      );
    }
  }
);

export const updateClassroomTypeRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit ClassroomTypeResponse @field(.classroomType, ClassroomType)',
      true
    ),
    description: 'Update a navigator classroom type',
    parameters: [navigatorIdPathParam],
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
      404: { description: 'Classroom type not found' },
      409: { description: 'A classroom type with this name already exists' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateClassroomTypeSchema),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(navigatorClassroomType)
      .where(eq(navigatorClassroomType.id, id));

    if (!existing) {
      throw notFound('Classroom type not found');
    }

    if (payload.name !== undefined) {
      await assertClassroomTypeNameUnique(db, payload.name, id);
    }

    const set = {
      ...(payload.name !== undefined && { name: payload.name }),
      ...('colorhex' in payload && { colorhex: payload.colorhex ?? null }),
    };

    if (Object.keys(set).length === 0) {
      return ok(c, { classroomType: existing });
    }

    try {
      const [updated] = await db
        .update(navigatorClassroomType)
        .set(set)
        .where(eq(navigatorClassroomType.id, id))
        .returning();

      if (!updated) {
        throw notFound('Classroom type not found');
      }

      return ok(c, { classroomType: updated });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A classroom type with this name already exists'
      );
    }
  }
);

export const deleteClassroomTypeRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@nodata', true),
    description: 'Delete a navigator classroom type',
    parameters: [navigatorIdPathParam],
    responses: {
      200: { description: 'Classroom type deleted' },
      404: { description: 'Classroom type not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(navigatorClassroomType)
      .where(eq(navigatorClassroomType.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Classroom type not found');
    }

    return ok(c, undefined);
  }
);
