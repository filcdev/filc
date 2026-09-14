import {
  createBuildingSchema,
  updateBuildingSchema,
} from '@filcdev/api/domains/navigator/building';
import { navigatorIdParamsSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { building as buildingTable } from '#database/schema/timetable';
import { authRouter } from '#middleware/auth';
import { navigatorFactory } from '#routes/navigator/_factory';
import { conflict, created, notFound, ok } from '#utils/http';
import { isReferencedRowError } from '#utils/navigator/errors';
import {
  buildingResponseSchema,
  buildingsResponseSchema,
} from '#utils/navigator/schemas';
import { filcExt } from '#utils/openapi';

const { schema: createBuildingRequestSchema } =
  await resolver(createBuildingSchema).toOpenAPISchema();
const { schema: updateBuildingRequestSchema } =
  await resolver(updateBuildingSchema).toOpenAPISchema();

export const listBuildingsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@listof Building'),
    description: 'List the campus buildings',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(buildingsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
  async (c) => {
    const buildings = await db
      .select()
      .from(buildingTable)
      .orderBy(asc(buildingTable.name));

    return ok(c, { buildings });
  }
);

export const createBuildingRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Building', true),
    description: 'Create a campus building',
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
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createBuildingSchema),
  async (c) => {
    const payload = c.req.valid('json');

    const [building] = await db
      .insert(buildingTable)
      .values({ id: crypto.randomUUID(), mapped: true, ...payload })
      .returning();

    return created(c, { building });
  }
);

export const updateBuildingRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Building', true),
    description: 'Update a campus building',
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
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Building not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateBuildingSchema),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    // An empty patch is a legal (if pointless) request, and Drizzle refuses to
    // build an `update … set` with no values. A campus save is an admin
    // placing the building, so it is mapped from then on.
    const [building] =
      Object.keys(payload).length > 0
        ? await db
            .update(buildingTable)
            .set({ ...payload, mapped: true })
            .where(eq(buildingTable.id, id))
            .returning()
        : await db.select().from(buildingTable).where(eq(buildingTable.id, id));

    if (!building) {
      throw notFound('Building not found');
    }

    return ok(c, { building });
  }
);

export const deleteBuildingRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Building', true),
    description:
      'Delete a campus building; its corridors, lifts and stairs cascade with it, but rooms still assigned to it refuse the delete',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(buildingResponseSchema),
          },
        },
        description: 'Building deleted',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Building not found' },
      409: { description: 'Building still has rooms' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    try {
      const [building] = await db
        .delete(buildingTable)
        .where(eq(buildingTable.id, id))
        .returning();

      if (!building) {
        throw notFound('Building not found');
      }

      return ok(c, { building });
    } catch (error) {
      // The foreign key is what decides whether the building still has rooms:
      // translating its error avoids a pre-check query that would race a
      // concurrent insert.
      if (isReferencedRowError(error)) {
        throw conflict('Building still has rooms; delete them first', error);
      }
      throw error;
    }
  }
);
