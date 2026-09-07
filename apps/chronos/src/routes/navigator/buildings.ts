import {
  createBuildingSchema,
  updateBuildingSchema,
} from '@filcdev/api/domains/navigator/building';
import { idParamSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorBuilding } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { created, notFound, ok } from '#utils/http';
import { pickDefined } from '#utils/navigator/pick-defined';
import {
  buildingResponseSchema,
  buildingsResponseSchema,
} from '#utils/navigator/schemas';
import {
  assertBuildingNameUnique,
  conflictOnUniqueViolation,
} from '#utils/navigator/uniqueness';
import { filcExt } from '#utils/openapi';
import { navigatorFactory, navigatorIdPathParam } from './_factory';

const { schema: createBuildingRequestSchema } =
  await resolver(createBuildingSchema).toOpenAPISchema();
const { schema: updateBuildingRequestSchema } =
  await resolver(updateBuildingSchema).toOpenAPISchema();

export const listBuildingsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit BuildingListResponse @field(.buildings, List<Building>)',
      true
    ),
    description: 'List all navigator buildings',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(buildingsResponseSchema),
          },
        },
        description: 'List of buildings',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  async (c) => {
    const buildings = await db
      .select()
      .from(navigatorBuilding)
      .orderBy(asc(navigatorBuilding.name));

    return ok(c, { buildings });
  }
);

export const createBuildingRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit BuildingResponse @field(.building, Building)',
      true
    ),
    description: 'Create a new navigator building',
    requestBody: {
      content: {
        'application/json': {
          schema: createBuildingRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(buildingResponseSchema),
          },
        },
        description: 'Building created',
      },
      409: { description: 'A building with this name already exists' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createBuildingSchema),
  async (c) => {
    const payload = c.req.valid('json');

    await assertBuildingNameUnique(db, payload.name);

    try {
      const [inserted] = await db
        .insert(navigatorBuilding)
        .values(payload)
        .returning();

      return created(c, { building: inserted });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A building with this name already exists'
      );
    }
  }
);

export const updateBuildingRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit BuildingResponse @field(.building, Building)',
      true
    ),
    description: 'Update a navigator building',
    parameters: [navigatorIdPathParam],
    requestBody: {
      content: {
        'application/json': {
          schema: updateBuildingRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(buildingResponseSchema),
          },
        },
        description: 'Building updated',
      },
      404: { description: 'Building not found' },
      409: { description: 'A building with this name already exists' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateBuildingSchema),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(navigatorBuilding)
      .where(eq(navigatorBuilding.id, id));

    if (!existing) {
      throw notFound('Building not found');
    }

    if (payload.name !== undefined) {
      await assertBuildingNameUnique(db, payload.name, id);
    }

    const set = pickDefined(payload);
    if (Object.keys(set).length === 0) {
      return ok(c, { building: existing });
    }

    try {
      const [updated] = await db
        .update(navigatorBuilding)
        .set(set)
        .where(eq(navigatorBuilding.id, id))
        .returning();

      return ok(c, { building: updated });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A building with this name already exists'
      );
    }
  }
);

export const deleteBuildingRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@nodata', true),
    description: 'Delete a navigator building',
    parameters: [navigatorIdPathParam],
    responses: {
      200: { description: 'Building deleted' },
      404: { description: 'Building not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(navigatorBuilding)
      .where(eq(navigatorBuilding.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Building not found');
    }

    return ok(c, undefined);
  }
);
