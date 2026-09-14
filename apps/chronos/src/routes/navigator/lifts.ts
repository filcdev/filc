import {
  createLiftSchema,
  updateLiftSchema,
} from '@filcdev/api/domains/navigator/lift';
import { navigatorIdParamsSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorLift } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { navigatorFactory } from '#routes/navigator/_factory';
import { created, notFound, ok } from '#utils/http';
import {
  liftResponseSchema,
  liftsResponseSchema,
} from '#utils/navigator/schemas';
import { filcExt } from '#utils/openapi';

const { schema: createLiftRequestSchema } =
  await resolver(createLiftSchema).toOpenAPISchema();
const { schema: updateLiftRequestSchema } =
  await resolver(updateLiftSchema).toOpenAPISchema();

export const listLiftsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@listof Lift'),
    description: 'List the lifts',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(liftsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
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
    ...filcExt('Navigator', '@unit Lift', true),
    description: 'Create a lift',
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
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createLiftSchema),
  async (c) => {
    const payload = c.req.valid('json');

    const [lift] = await db
      .insert(navigatorLift)
      .values({ id: crypto.randomUUID(), ...payload })
      .returning();

    return created(c, { lift });
  }
);

export const updateLiftRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Lift', true),
    description: 'Update a lift',
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
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Lift not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateLiftSchema),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    // An empty patch is a legal (if pointless) request, and Drizzle refuses to
    // build an `update … set` with no values.
    const [lift] =
      Object.keys(payload).length > 0
        ? await db
            .update(navigatorLift)
            .set(payload)
            .where(eq(navigatorLift.id, id))
            .returning()
        : await db.select().from(navigatorLift).where(eq(navigatorLift.id, id));

    if (!lift) {
      throw notFound('Lift not found');
    }

    return ok(c, { lift });
  }
);

export const deleteLiftRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Lift', true),
    description: 'Delete a lift',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(liftResponseSchema),
          },
        },
        description: 'Lift deleted',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Lift not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [lift] = await db
      .delete(navigatorLift)
      .where(eq(navigatorLift.id, id))
      .returning();

    if (!lift) {
      throw notFound('Lift not found');
    }

    return ok(c, { lift });
  }
);
