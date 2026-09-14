import {
  createCorridorSchema,
  updateCorridorSchema,
} from '@filcdev/api/domains/navigator/corridor';
import { navigatorIdParamsSchema } from '@filcdev/api/domains/navigator/params';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorCorridor } from '#database/schema/navigator';
import { authRouter } from '#middleware/auth';
import { navigatorFactory } from '#routes/navigator/_factory';
import { created, notFound, ok } from '#utils/http';
import {
  corridorResponseSchema,
  corridorsResponseSchema,
} from '#utils/navigator/schemas';
import { filcExt } from '#utils/openapi';

const { schema: createCorridorRequestSchema } =
  await resolver(createCorridorSchema).toOpenAPISchema();
const { schema: updateCorridorRequestSchema } =
  await resolver(updateCorridorSchema).toOpenAPISchema();

export const listCorridorsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@listof Corridor'),
    description: 'List the corridors',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(corridorsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
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
    ...filcExt('Navigator', '@unit Corridor', true),
    description: 'Create a corridor',
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
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createCorridorSchema),
  async (c) => {
    const payload = c.req.valid('json');

    const [corridor] = await db
      .insert(navigatorCorridor)
      .values({ id: crypto.randomUUID(), ...payload })
      .returning();

    return created(c, { corridor });
  }
);

export const updateCorridorRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Corridor', true),
    description: 'Update a corridor',
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
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Corridor not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateCorridorSchema),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    // An empty patch is a legal (if pointless) request, and Drizzle refuses to
    // build an `update … set` with no values.
    const [corridor] =
      Object.keys(payload).length > 0
        ? await db
            .update(navigatorCorridor)
            .set(payload)
            .where(eq(navigatorCorridor.id, id))
            .returning()
        : await db
            .select()
            .from(navigatorCorridor)
            .where(eq(navigatorCorridor.id, id));

    if (!corridor) {
      throw notFound('Corridor not found');
    }

    return ok(c, { corridor });
  }
);

export const deleteCorridorRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Corridor', true),
    description: 'Delete a corridor',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(corridorResponseSchema),
          },
        },
        description: 'Corridor deleted',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Corridor not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [corridor] = await db
      .delete(navigatorCorridor)
      .where(eq(navigatorCorridor.id, id))
      .returning();

    if (!corridor) {
      throw notFound('Corridor not found');
    }

    return ok(c, { corridor });
  }
);
