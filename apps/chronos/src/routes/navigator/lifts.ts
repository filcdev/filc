import {
  createLiftSchema,
  updateLiftSchema,
} from '@filcdev/api/domains/navigator/lift';
import { idParamSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorLift } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { created, notFound, ok } from '#utils/http';
import { pickDefined } from '#utils/navigator/pick-defined';
import {
  liftResponseSchema,
  liftsResponseSchema,
} from '#utils/navigator/schemas';
import {
  assertLiftNameUnique,
  conflictOnUniqueViolation,
} from '#utils/navigator/uniqueness';
import { filcExt } from '#utils/openapi';
import { navigatorFactory, navigatorIdPathParam } from './_factory';

const { schema: createLiftRequestSchema } =
  await resolver(createLiftSchema).toOpenAPISchema();
const { schema: updateLiftRequestSchema } =
  await resolver(updateLiftSchema).toOpenAPISchema();

export const listLiftsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit LiftListResponse @field(.lifts, List<Lift>)',
      true
    ),
    description: 'List all navigator lifts',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(liftsResponseSchema),
          },
        },
        description: 'List of lifts',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  async (c) => {
    const lifts = await db
      .select()
      .from(navigatorLift)
      .orderBy(asc(navigatorLift.name));

    return ok(c, { lifts });
  }
);

export const createLiftRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit LiftResponse @field(.lift, Lift)', true),
    description: 'Create a new navigator lift',
    requestBody: {
      content: {
        'application/json': {
          schema: createLiftRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(liftResponseSchema),
          },
        },
        description: 'Lift created',
      },
      409: {
        description: 'A lift with this name already exists in this building',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createLiftSchema),
  async (c) => {
    const payload = c.req.valid('json');

    await assertLiftNameUnique(db, payload.name, payload.buildingId);

    try {
      const [inserted] = await db
        .insert(navigatorLift)
        .values(payload)
        .returning();

      return created(c, { lift: inserted });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A lift with this name already exists in this building'
      );
    }
  }
);

export const updateLiftRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit LiftResponse @field(.lift, Lift)', true),
    description: 'Update a navigator lift',
    parameters: [navigatorIdPathParam],
    requestBody: {
      content: {
        'application/json': {
          schema: updateLiftRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(liftResponseSchema),
          },
        },
        description: 'Lift updated',
      },
      404: { description: 'Lift not found' },
      409: {
        description: 'A lift with this name already exists in this building',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateLiftSchema),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(navigatorLift)
      .where(eq(navigatorLift.id, id));

    if (!existing) {
      throw notFound('Lift not found');
    }

    const name = payload.name ?? existing.name;
    const buildingId = payload.buildingId ?? existing.buildingId;

    if (payload.name !== undefined || payload.buildingId !== undefined) {
      await assertLiftNameUnique(db, name, buildingId, id);
    }

    const set = pickDefined(payload);
    if (Object.keys(set).length === 0) {
      return ok(c, { lift: existing });
    }

    try {
      const [updated] = await db
        .update(navigatorLift)
        .set(set)
        .where(eq(navigatorLift.id, id))
        .returning();

      return ok(c, { lift: updated });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A lift with this name already exists in this building'
      );
    }
  }
);

export const deleteLiftRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@nodata', true),
    description: 'Delete a navigator lift',
    parameters: [navigatorIdPathParam],
    responses: {
      200: { description: 'Lift deleted' },
      404: { description: 'Lift not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(navigatorLift)
      .where(eq(navigatorLift.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Lift not found');
    }

    return ok(c, undefined);
  }
);
