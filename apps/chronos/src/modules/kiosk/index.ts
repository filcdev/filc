import {
  type KioskKind,
  navigatorKioskConfigSchema,
  tvKioskConfigSchema,
} from '@filcdev/api/domains/kiosk/config';
import { permissions } from '@filcdev/api/permissions';
import { getLogger } from '@logtape/logtape';
import { asc, eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { kiosk } from '#modules/kiosk/schema';
import { base } from '#orpc';
import { badRequest, conflict, notFound } from '#utils/http';

const logger = getLogger(['chronos', 'kiosk']);

const MACHINE_ID_CONSTRAINT = 'kiosk_machine_id_unique';
const UNIQUE_VIOLATION = '23505';

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

export const listKiosks = base.kiosk.list
  .use(requireAuthorization(permissions.kiosksManage))
  .handler(async () => {
    const kiosks = await db.select().from(kiosk).orderBy(asc(kiosk.name));

    return { kiosks };
  });

export const createKiosk = base.kiosk.create
  .use(requireAuthorization(permissions.kiosksManage))
  .handler(async ({ errors, input }) => {
    const config = parseKioskConfig(input.kind, input.config);

    let inserted: typeof kiosk.$inferSelect | undefined;
    try {
      [inserted] = await db
        .insert(kiosk)
        .values({
          config,
          kind: input.kind,
          machineId: input.machineId,
          name: input.name,
        })
        .returning();
    } catch (error) {
      if (isMachineIdConflict(error)) {
        throw conflict('A kiosk with this machine id already exists.');
      }
      logger.error('Failed to create kiosk', { error });
      throw errors.INTERNAL({
        cause: error,
        message: 'Failed to create kiosk',
      });
    }

    if (!inserted) {
      throw errors.INTERNAL({ message: 'Failed to create kiosk' });
    }

    return { kiosk: inserted };
  });

export const updateKiosk = base.kiosk.update
  .use(requireAuthorization(permissions.kiosksManage))
  .handler(async ({ input }) => {
    const { id, ...payload } = input;

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
      return { kiosk: existing };
    }

    const [updated] = await db
      .update(kiosk)
      .set(changes)
      .where(eq(kiosk.id, id))
      .returning();

    if (!updated) {
      throw notFound('Kiosk not found');
    }

    return { kiosk: updated };
  });

export const deleteKiosk = base.kiosk.delete
  .use(requireAuthorization(permissions.kiosksManage))
  .handler(async ({ input }) => {
    const { id } = input;

    const [deleted] = await db
      .delete(kiosk)
      .where(eq(kiosk.id, id))
      .returning();

    if (!deleted) {
      throw notFound('Kiosk not found');
    }

    return { kiosk: deleted };
  });
