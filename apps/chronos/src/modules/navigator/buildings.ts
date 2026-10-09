import { permissions } from '@filcdev/api/permissions';
import { ORPCError } from '@orpc/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '#database';
import { requireAuthorization } from '#middleware/auth';
import { isReferencedRowError } from '#modules/navigator/utils/errors';
import { building as buildingTable } from '#modules/timetable/schema';
import { base } from '#orpc';
import { conflict, notFound } from '#utils/http';

export const listBuildingsRoute = base.navigator.buildings.list.handler(
  async () => {
    const buildings = await db
      .select()
      .from(buildingTable)
      .orderBy(asc(buildingTable.name));

    return { buildings };
  }
);

export const createBuildingRoute = base.navigator.buildings.create
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const [building] = await db
      .insert(buildingTable)
      .values({ id: crypto.randomUUID(), mapped: true, ...input })
      .returning();

    if (!building) {
      throw new ORPCError('INTERNAL', {
        message: 'Failed to create building',
      });
    }

    return { building };
  });

export const updateBuildingRoute = base.navigator.buildings.update
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id, ...payload } = input;

    // An empty patch is a legal (if pointless) request, and Drizzle refuses to
    // build an `update … set` with no values. A campus save is an admin
    // placing the building, so it is mapped from then on.
    const [building] =
      Object.keys(payload).length > 0
        ? await db
            .update(buildingTable)
            .set({ ...payload, mapped: true })
            .where(eq(buildingTable.id, id))
            .returning()
        : await db.select().from(buildingTable).where(eq(buildingTable.id, id));

    if (!building) {
      throw notFound('Building not found');
    }

    return { building };
  });

export const deleteBuildingRoute = base.navigator.buildings.delete
  .use(requireAuthorization(permissions.navigatorManage))
  .handler(async ({ input }) => {
    const { id } = input;

    try {
      const [building] = await db
        .delete(buildingTable)
        .where(eq(buildingTable.id, id))
        .returning();

      if (!building) {
        throw notFound('Building not found');
      }

      return { building };
    } catch (error) {
      // The foreign key is what decides whether the building still has rooms:
      // translating its error avoids a pre-check query that would race a
      // concurrent insert.
      if (isReferencedRowError(error)) {
        throw conflict('Building still has rooms; delete them first', error);
      }
      throw error;
    }
  });
