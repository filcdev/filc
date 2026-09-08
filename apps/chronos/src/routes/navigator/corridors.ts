import {
  createCorridorSchema,
  updateCorridorSchema,
} from '@filcdev/api/domains/navigator/corridor';
import { idParamSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorCorridor } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { created, internalServerError, notFound, ok } from '#utils/http';
import { pickDefined } from '#utils/navigator/pick-defined';
import {
  corridorResponseSchema,
  corridorsResponseSchema,
} from '#utils/navigator/schemas';
import {
  assertCorridorNameUnique,
  conflictOnUniqueViolation,
} from '#utils/navigator/uniqueness';
import { filcExt } from '#utils/openapi';
import { navigatorFactory, navigatorIdPathParam } from './_factory';

const { schema: createCorridorRequestSchema } =
  await resolver(createCorridorSchema).toOpenAPISchema();
const { schema: updateCorridorRequestSchema } =
  await resolver(updateCorridorSchema).toOpenAPISchema();

export const listCorridorsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit CorridorListResponse @field(.corridors, List<Corridor>)',
      true
    ),
    description: 'List all navigator corridors',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(corridorsResponseSchema),
          },
        },
        description: 'List of corridors',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  async (c) => {
    const corridors = await db
      .select()
      .from(navigatorCorridor)
      .orderBy(asc(navigatorCorridor.name));

    return ok(c, { corridors });
  }
);

export const createCorridorRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit CorridorResponse @field(.corridor, Corridor)',
      true
    ),
    description: 'Create a new navigator corridor',
    requestBody: {
      content: {
        'application/json': {
          schema: createCorridorRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(corridorResponseSchema),
          },
        },
        description: 'Corridor created',
      },
      409: {
        description:
          'A corridor with this name already exists in this building',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createCorridorSchema),
  async (c) => {
    const payload = c.req.valid('json');

    await assertCorridorNameUnique(db, payload.name, payload.buildingId);

    try {
      const [inserted] = await db
        .insert(navigatorCorridor)
        .values(payload)
        .returning();

      if (!inserted) {
        throw internalServerError('Failed to create corridor');
      }

      return created(c, { corridor: inserted });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A corridor with this name already exists in this building'
      );
    }
  }
);

export const updateCorridorRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit CorridorResponse @field(.corridor, Corridor)',
      true
    ),
    description: 'Update a navigator corridor',
    parameters: [navigatorIdPathParam],
    requestBody: {
      content: {
        'application/json': {
          schema: updateCorridorRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(corridorResponseSchema),
          },
        },
        description: 'Corridor updated',
      },
      404: { description: 'Corridor not found' },
      409: {
        description:
          'A corridor with this name already exists in this building',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateCorridorSchema),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(navigatorCorridor)
      .where(eq(navigatorCorridor.id, id));

    if (!existing) {
      throw notFound('Corridor not found');
    }

    const name = payload.name ?? existing.name;
    const buildingId = payload.buildingId ?? existing.buildingId;

    if (payload.name !== undefined || payload.buildingId !== undefined) {
      await assertCorridorNameUnique(db, name, buildingId, id);
    }

    const set = pickDefined(payload);
    if (Object.keys(set).length === 0) {
      return ok(c, { corridor: existing });
    }

    try {
      const [updated] = await db
        .update(navigatorCorridor)
        .set(set)
        .where(eq(navigatorCorridor.id, id))
        .returning();

      if (!updated) {
        throw notFound('Corridor not found');
      }

      return ok(c, { corridor: updated });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A corridor with this name already exists in this building'
      );
    }
  }
);

export const deleteCorridorRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@nodata', true),
    description: 'Delete a navigator corridor',
    parameters: [navigatorIdPathParam],
    responses: {
      200: { description: 'Corridor deleted' },
      404: { description: 'Corridor not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(navigatorCorridor)
      .where(eq(navigatorCorridor.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Corridor not found');
    }

    return ok(c, undefined);
  }
);
