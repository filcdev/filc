import { idParamSchema } from '@filcdev/api/domains/navigator/params';
import {
  createStairSchema,
  updateStairSchema,
} from '@filcdev/api/domains/navigator/stair';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorStair } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import {
  badRequest,
  created,
  internalServerError,
  notFound,
  ok,
} from '#utils/http';
import { pickDefined } from '#utils/navigator/pick-defined';
import {
  stairResponseSchema,
  stairsResponseSchema,
} from '#utils/navigator/schemas';
import {
  assertStairNameUnique,
  conflictOnUniqueViolation,
} from '#utils/navigator/uniqueness';
import { filcExt } from '#utils/openapi';
import { navigatorFactory, navigatorIdPathParam } from './_factory';

const { schema: createStairRequestSchema } =
  await resolver(createStairSchema).toOpenAPISchema();
const { schema: updateStairRequestSchema } =
  await resolver(updateStairSchema).toOpenAPISchema();

export const listStairsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit StairListResponse @field(.stairs, List<Stair>)',
      true
    ),
    description: 'List all navigator stairs',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(stairsResponseSchema),
          },
        },
        description: 'List of stairs',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  async (c) => {
    const stairs = await db
      .select()
      .from(navigatorStair)
      .orderBy(asc(navigatorStair.name));

    return ok(c, { stairs });
  }
);

export const createStairRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit StairResponse @field(.stair, Stair)', true),
    description: 'Create a new navigator stair',
    requestBody: {
      content: {
        'application/json': {
          schema: createStairRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(stairResponseSchema),
          },
        },
        description: 'Stair created',
      },
      409: {
        description: 'A stair with this name already exists in this building',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createStairSchema),
  async (c) => {
    const payload = c.req.valid('json');

    await assertStairNameUnique(db, payload.name, payload.buildingId);

    try {
      const [inserted] = await db
        .insert(navigatorStair)
        .values(payload)
        .returning();

      if (!inserted) {
        throw internalServerError('Failed to create stair');
      }

      return created(c, { stair: inserted });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A stair with this name already exists in this building'
      );
    }
  }
);

export const updateStairRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit StairResponse @field(.stair, Stair)', true),
    description: 'Update a navigator stair',
    parameters: [navigatorIdPathParam],
    requestBody: {
      content: {
        'application/json': {
          schema: updateStairRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(stairResponseSchema),
          },
        },
        description: 'Stair updated',
      },
      404: { description: 'Stair not found' },
      409: {
        description: 'A stair with this name already exists in this building',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateStairSchema),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(navigatorStair)
      .where(eq(navigatorStair.id, id));

    if (!existing) {
      throw notFound('Stair not found');
    }

    const minStorey = payload.minStorey ?? existing.minStorey;
    const maxStorey = payload.maxStorey ?? existing.maxStorey;

    if (minStorey > maxStorey) {
      throw badRequest('minStorey must be less than or equal to maxStorey');
    }

    const name = payload.name ?? existing.name;
    const buildingId = payload.buildingId ?? existing.buildingId;

    if (payload.name !== undefined || payload.buildingId !== undefined) {
      await assertStairNameUnique(db, name, buildingId, id);
    }

    const set = pickDefined(payload);
    if (Object.keys(set).length === 0) {
      return ok(c, { stair: existing });
    }

    try {
      const [updated] = await db
        .update(navigatorStair)
        .set(set)
        .where(eq(navigatorStair.id, id))
        .returning();

      if (!updated) {
        throw notFound('Stair not found');
      }

      return ok(c, { stair: updated });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A stair with this name already exists in this building'
      );
    }
  }
);

export const deleteStairRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@nodata', true),
    description: 'Delete a navigator stair',
    parameters: [navigatorIdPathParam],
    responses: {
      200: { description: 'Stair deleted' },
      404: { description: 'Stair not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(navigatorStair)
      .where(eq(navigatorStair.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Stair not found');
    }

    return ok(c, undefined);
  }
);
