import {
  type KioskKind,
  navigatorKioskConfigSchema,
  tvKioskConfigSchema,
} from '@filcdev/api/domains/kiosk/config';
import {
  createKioskSchema,
  kioskIdParamsSchema,
  updateKioskSchema,
} from '@filcdev/api/domains/kiosk/crud';
import { permissions } from '@filcdev/api/permissions';
import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import { db } from '#database';
import { kiosk } from '#database/schema/kiosk';
import { authRouter } from '#middleware/auth';
import { badRequest, conflict, created, notFound, ok } from '#utils/http';
import {
  kioskListResponseSchema,
  kioskResponseSchema,
} from '#utils/kiosk/schemas';
import { filcExt } from '#utils/openapi';
import { kioskFactory } from './_factory';

const logger = getLogger(['chronos', 'kiosk']);

const MACHINE_ID_CONSTRAINT = 'kiosk_machine_id_unique';
const UNIQUE_VIOLATION = '23505';

const { schema: createRequestSchema } =
  await resolver(createKioskSchema).toOpenAPISchema();
const { schema: updateRequestSchema } =
  await resolver(updateKioskSchema).toOpenAPISchema();

/**
 * The discriminator and the config blob arrive as separate fields, so the blob
 * is validated against the kind here. A missing config is validated as an
 * empty one: the navigator schema fills in its defaults, while a tv kiosk must
 * at least carry a `departures` array.
 */
function parseKioskConfig(kind: KioskKind, config: unknown) {
  const schema =
    kind === 'tv' ? tvKioskConfigSchema : navigatorKioskConfigSchema;
  const result = schema.safeParse(config ?? {});

  if (!result.success) {
    throw badRequest(`Invalid ${kind} kiosk config`, result.error);
  }

  return result.data;
}

/**
 * Drizzle wraps driver errors, so the violation is reported on the cause
 * chain. `machine_id` is the kiosk table's only unique constraint, so both its
 * name and the SQLSTATE (Bun exposes it as `errno`) identify the conflict.
 */
function isMachineIdConflict(error: unknown): boolean {
  let current: unknown = error;

  while (current !== null && typeof current === 'object') {
    const { constraint, errno } = current as {
      constraint?: unknown;
      errno?: unknown;
    };

    if (constraint === MACHINE_ID_CONSTRAINT || errno === UNIQUE_VIOLATION) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

export const listKiosksRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Kiosk',
      '@unit KioskListResponse @field(.kiosks, List<Kiosk>)',
      true
    ),
    description: 'List all kiosks',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(kioskListResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Kiosk'],
  }),
  ...authRouter(permissions.kiosksManage),
  async (c) => {
    const kiosks = await db.select().from(kiosk).orderBy(asc(kiosk.name));

    return ok(c, { kiosks });
  }
);

export const createKioskRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt('Kiosk', '@unit KioskResponse @field(.kiosk, Kiosk)', true),
    description: 'Register a kiosk',
    requestBody: {
      content: {
        'application/json': {
          schema: createRequestSchema,
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: resolver(kioskResponseSchema),
          },
        },
        description: 'Kiosk created',
      },
    },
    tags: ['Kiosk'],
  }),
  ...authRouter(permissions.kiosksManage),
  zValidator('json', createKioskSchema),
  async (c) => {
    const payload = c.req.valid('json');
    const config = parseKioskConfig(payload.kind, payload.config);

    try {
      const [inserted] = await db
        .insert(kiosk)
        .values({
          config,
          kind: payload.kind,
          machineId: payload.machineId,
          name: payload.name,
        })
        .returning();

      return created(c, { kiosk: inserted });
    } catch (error) {
      if (isMachineIdConflict(error)) {
        throw conflict('A kiosk with this machine id already exists.');
      }
      logger.error('Failed to create kiosk', { error });
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to create kiosk',
      });
    }
  }
);

export const updateKioskRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt('Kiosk', '@unit KioskResponse @field(.kiosk, Kiosk)', true),
    description: 'Update a kiosk',
    requestBody: {
      content: {
        'application/json': {
          schema: updateRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(kioskResponseSchema),
          },
        },
        description: 'Kiosk updated',
      },
      404: { description: 'Kiosk not found' },
    },
    tags: ['Kiosk'],
  }),
  ...authRouter(permissions.kiosksManage),
  zValidator('param', kioskIdParamsSchema),
  zValidator('json', updateKioskSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const payload = c.req.valid('json');

    const [existing] = await db.select().from(kiosk).where(eq(kiosk.id, id));

    if (!existing) {
      throw notFound('Kiosk not found');
    }

    const effectiveKind = payload.kind ?? (existing.kind as KioskKind);
    const changes = {
      ...(payload.config === undefined
        ? {}
        : { config: parseKioskConfig(effectiveKind, payload.config) }),
      ...(payload.enabled === undefined ? {} : { enabled: payload.enabled }),
      ...(payload.kind === undefined ? {} : { kind: payload.kind }),
      ...(payload.name === undefined ? {} : { name: payload.name }),
    };

    if (Object.keys(changes).length === 0) {
      return ok(c, { kiosk: existing });
    }

    const [updated] = await db
      .update(kiosk)
      .set(changes)
      .where(eq(kiosk.id, id))
      .returning();

    if (!updated) {
      throw notFound('Kiosk not found');
    }

    return ok(c, { kiosk: updated });
  }
);

export const deleteKioskRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt('Kiosk', '@unit KioskResponse @field(.kiosk, Kiosk)', true),
    description: 'Delete a kiosk',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(kioskResponseSchema),
          },
        },
        description: 'Kiosk deleted',
      },
      404: { description: 'Kiosk not found' },
    },
    tags: ['Kiosk'],
  }),
  ...authRouter(permissions.kiosksManage),
  zValidator('param', kioskIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid('param');

    const [deleted] = await db
      .delete(kiosk)
      .where(eq(kiosk.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Kiosk not found');
    }

    return ok(c, { kiosk: deleted });
  }
);
