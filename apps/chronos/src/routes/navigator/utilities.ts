import { idParamSchema } from '@filcdev/api/domains/navigator/params';
import {
  createUtilitySchema,
  updateUtilitySchema,
  utilityKindQuerySchema,
} from '@filcdev/api/domains/navigator/utility';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { asc, eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { db } from '#database';
import { navigatorUtility } from '#database/schema/navigator';
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
  utilitiesResponseSchema,
  utilityResponseSchema,
} from '#utils/navigator/schemas';
import {
  assertUtilityNameUnique,
  conflictOnUniqueViolation,
} from '#utils/navigator/uniqueness';
import { filcExt } from '#utils/openapi';
import { navigatorFactory, navigatorIdPathParam } from './_factory';

const { schema: createUtilityRequestSchema } =
  await resolver(createUtilitySchema).toOpenAPISchema();
const { schema: updateUtilityRequestSchema } =
  await resolver(updateUtilitySchema).toOpenAPISchema();

export const listUtilitiesRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit UtilityListResponse @field(.utilities, List<Utility>)',
      true
    ),
    description: 'List all navigator utilities, optionally filtered by kind',
    parameters: [
      {
        in: 'query',
        name: 'kind',
        required: false,
        schema: { enum: ['corridor', 'lift', 'stair'], type: 'string' },
      },
    ],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(utilitiesResponseSchema),
          },
        },
        description: 'List of utilities',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('query', utilityKindQuerySchema),
  async (c) => {
    const { kind } = c.req.valid('query');

    const utilities = await db
      .select()
      .from(navigatorUtility)
      .where(kind ? eq(navigatorUtility.kind, kind) : undefined)
      .orderBy(asc(navigatorUtility.name));

    return ok(c, { utilities });
  }
);

export const createUtilityRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit UtilityResponse @field(.utility, Utility)',
      true
    ),
    description: 'Create a new navigator utility',
    requestBody: {
      content: {
        'application/json': {
          schema: createUtilityRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(utilityResponseSchema),
          },
        },
        description: 'Utility created',
      },
      409: {
        description:
          'A utility with this name already exists in this building for this kind',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', createUtilitySchema),
  async (c) => {
    const payload = c.req.valid('json');

    await assertUtilityNameUnique(
      db,
      payload.name,
      payload.buildingId,
      payload.kind
    );

    try {
      const [inserted] = await db
        .insert(navigatorUtility)
        .values(payload)
        .returning();

      if (!inserted) {
        throw internalServerError('Failed to create utility');
      }

      return created(c, { utility: inserted });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A utility with this name already exists in this building for this kind'
      );
    }
  }
);

export const getUtilityRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit UtilityResponse @field(.utility, Utility)',
      true
    ),
    description: 'Fetch a navigator utility by id',
    parameters: [navigatorIdPathParam],
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(utilityResponseSchema),
          },
        },
        description: 'Utility',
      },
      404: { description: 'Utility not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [utility] = await db
      .select()
      .from(navigatorUtility)
      .where(eq(navigatorUtility.id, id));

    if (!utility) {
      throw notFound('Utility not found');
    }

    return ok(c, { utility });
  }
);

export const updateUtilityRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Navigator',
      '@unit UtilityResponse @field(.utility, Utility)',
      true
    ),
    description: 'Update a navigator utility',
    parameters: [navigatorIdPathParam],
    requestBody: {
      content: {
        'application/json': {
          schema: updateUtilityRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(utilityResponseSchema),
          },
        },
        description: 'Utility updated',
      },
      400: { description: 'Invalid storey range' },
      404: { description: 'Utility not found' },
      409: {
        description:
          'A utility with this name already exists in this building for this kind',
      },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('json', updateUtilitySchema),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [existing] = await db
      .select()
      .from(navigatorUtility)
      .where(eq(navigatorUtility.id, id));

    if (!existing) {
      throw notFound('Utility not found');
    }

    if (payload.kind !== 'corridor') {
      const minStorey = payload.minStorey ?? existing.minStorey;
      const maxStorey = payload.maxStorey ?? existing.maxStorey;
      if (minStorey !== null && maxStorey !== null && minStorey > maxStorey) {
        throw badRequest('minStorey must be less than or equal to maxStorey');
      }
    }

    const name = payload.name ?? existing.name;
    const buildingId = payload.buildingId ?? existing.buildingId;

    if (payload.name !== undefined || payload.buildingId !== undefined) {
      await assertUtilityNameUnique(db, name, buildingId, payload.kind, id);
    }

    const { kind: _kind, ...fields } = payload;
    const set = pickDefined(fields);
    if (Object.keys(set).length === 0) {
      return ok(c, { utility: existing });
    }

    try {
      const [updated] = await db
        .update(navigatorUtility)
        .set(set)
        .where(eq(navigatorUtility.id, id))
        .returning();

      if (!updated) {
        throw notFound('Utility not found');
      }

      return ok(c, { utility: updated });
    } catch (err) {
      throw conflictOnUniqueViolation(
        err,
        'A utility with this name already exists in this building for this kind'
      );
    }
  }
);

export const deleteUtilityRoute = navigatorFactory.createHandlers(
  describeRoute({
    ...filcExt('Navigator', '@nodata', true),
    description: 'Delete a navigator utility',
    parameters: [navigatorIdPathParam],
    responses: {
      200: { description: 'Utility deleted' },
      404: { description: 'Utility not found' },
    },
    tags: ['Navigator'],
  }),
  ...authRouter(permissions.navigatorManage),
  zValidator('param', idParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(navigatorUtility)
      .where(eq(navigatorUtility.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Utility not found');
    }

    return ok(c, undefined);
  }
);
