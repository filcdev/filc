import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { navigatorStair } from '#modules/navigator/schema';
import { base } from '#orpc';
import { notFound } from '#utils/http';

export const listStairsRoute = base.navigator.stairs.list.handler(async () => {
  const stairs = await db
    .select()
    .from(navigatorStair)
    .orderBy(asc(navigatorStair.name));

  return { stairs };
});

export const createStairRoute = base.navigator.stairs.create
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const [stair] = await db
      .insert(navigatorStair)
      .values({ id: crypto.randomUUID(), ...input })
      .returning();

    if (!stair) {
      throw new ORPCError('INTERNAL', { message: 'Failed to create stair' });
    }

    return { stair };
  });

export const updateStairRoute = base.navigator.stairs.update
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id, ...payload } = input;

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

    return { stair };
  });

export const deleteStairRoute = base.navigator.stairs.delete
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id } = input;

    const [stair] = await db
      .delete(navigatorStair)
      .where(eq(navigatorStair.id, id))
      .returning();

    if (!stair) {
      throw notFound('Staircase not found');
    }

    return { stair };
  });
