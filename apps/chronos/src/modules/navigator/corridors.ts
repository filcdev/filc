import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { navigatorCorridor } from '#modules/navigator/schema';
import { base } from '#orpc';
import { notFound } from '#utils/http';

export const listCorridorsRoute = base.navigator.corridors.list.handler(
  async () => {
    const corridors = await db
      .select()
      .from(navigatorCorridor)
      .orderBy(asc(navigatorCorridor.name));

    return { corridors };
  }
);

export const createCorridorRoute = base.navigator.corridors.create
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const [corridor] = await db
      .insert(navigatorCorridor)
      .values({ id: crypto.randomUUID(), ...input })
      .returning();

    if (!corridor) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create corridor',
      });
    }

    return { corridor };
  });

export const updateCorridorRoute = base.navigator.corridors.update
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id, ...payload } = input;

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

    return { corridor };
  });

export const deleteCorridorRoute = base.navigator.corridors.delete
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id } = input;

    const [corridor] = await db
      .delete(navigatorCorridor)
      .where(eq(navigatorCorridor.id, id))
      .returning();

    if (!corridor) {
      throw notFound('Corridor not found');
    }

    return { corridor };
  });
