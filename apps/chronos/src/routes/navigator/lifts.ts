import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '#database';
import { navigatorLift } from '#database/schema/navigator';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { notFound } from '#utils/http';

export const listLiftsRoute = base.navigator.lifts.list.handler(async () => {
  const lifts = await db
    .select()
    .from(navigatorLift)
    .orderBy(asc(navigatorLift.name));

  return { lifts };
});

export const createLiftRoute = base.navigator.lifts.create
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const [lift] = await db
      .insert(navigatorLift)
      .values({ id: crypto.randomUUID(), ...input })
      .returning();

    if (!lift) {
      throw new ORPCError('INTERNAL', { message: 'Failed to create lift' });
    }

    return { lift };
  });

export const updateLiftRoute = base.navigator.lifts.update
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id, ...payload } = input;

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

    return { lift };
  });

export const deleteLiftRoute = base.navigator.lifts.delete
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id } = input;

    const [lift] = await db
      .delete(navigatorLift)
      .where(eq(navigatorLift.id, id))
      .returning();

    if (!lift) {
      throw notFound('Lift not found');
    }

    return { lift };
  });
