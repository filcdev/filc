import { navigatorIdParamsSchema } from '@filcdev/api/domains/navigator/params';
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
import { navigatorFactory } from '#routes/navigator/_factory';
import { created, notFound, ok } from '#utils/http';
import {
  stairResponseSchema,
  stairsResponseSchema,
} from '#utils/navigator/schemas';
import { filcExt } from '#utils/openapi';

const { schema: createStairRequestSchema } =
  await resolver(createStairSchema).toOpenAPISchema();
const { schema: updateStairRequestSchema } =
  await resolver(updateStairSchema).toOpenAPISchema();

export const listStairsRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@listof Stair'),
    description: 'List the staircases',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(stairsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Navigator'],
  }),
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
    ...filcExt('Navigator', '@unit Stair', true),
    description: 'Create a staircase',
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
        description: 'Staircase created',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createStairSchema),
  async (c) => {
    const payload = c.req.valid('json');

    const [stair] = await db
      .insert(navigatorStair)
      .values({ id: crypto.randomUUID(), ...payload })
      .returning();

    return created(c, { stair });
  }
);

export const updateStairRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Stair', true),
    description: 'Update a staircase',
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
        description: 'Staircase updated',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Staircase not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateStairSchema),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    // An empty patch is a legal (if pointless) request, and Drizzle refuses to
    // build an `update … set` with no values.
    const [stair] =
      Object.keys(payload).length > 0
        ? await db
            .update(navigatorStair)
            .set(payload)
            .where(eq(navigatorStair.id, id))
            .returning()
        : await db
            .select()
            .from(navigatorStair)
            .where(eq(navigatorStair.id, id));

    if (!stair) {
      throw notFound('Staircase not found');
    }

    return ok(c, { stair });
  }
);

export const deleteStairRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@unit Stair', true),
    description: 'Delete a staircase',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(stairResponseSchema),
          },
        },
        description: 'Staircase deleted',
      },
      401: { description: 'Unauthorized' },
      403: { description: 'Forbidden' },
      404: { description: 'Staircase not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', navigatorIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [stair] = await db
      .delete(navigatorStair)
      .where(eq(navigatorStair.id, id))
      .returning();

    if (!stair) {
      throw notFound('Staircase not found');
    }

    return ok(c, { stair });
  }
);
