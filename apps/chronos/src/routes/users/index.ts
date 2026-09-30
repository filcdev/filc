import { permissions } from '@filcdev/api/permissions';
import { count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { getUserPermissionsBulk } from '#utils/authorization';
import { notFound } from '#utils/http';

export const listUsers = base.users.list
  .use(requireAuthorization(permissions.usersManage))
  .handler(async ({ input }) => {
    const { limit, offset, search } = input;

    const whereClause = search
      ? or(
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
          ilike(user.nickname, `%${search}%`)
        )
      : undefined;

    const usersQuery = await db
      .select()
      .from(user)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(user.createdAt));

    const permissionsByUser = await getUserPermissionsBulk(
      usersQuery.map((u) => u.id)
    );

    const users = usersQuery.map((u) => ({
      ...u,
      displayName: u.nickname ? u.nickname : u.name || 'Unknown user',
      permissions: permissionsByUser.get(u.id) ?? [],
    }));

    const [countResult] = await db
      .select({ count: count() })
      .from(user)
      .where(whereClause);

    return { total: countResult?.count ?? 0, users };
  });

export const updateUser = base.users.update
  .use(requireAuthorization(permissions.usersManage))
  .handler(async ({ input }) => {
    const { id: userId, cohortId, nickname, roles } = input;

    const [updatedUser] = await db
      .update(user)
      .set({
        ...(cohortId === undefined ? {} : { cohortId }),
        ...(nickname === undefined ? {} : { nickname }),
        ...(roles === undefined ? {} : { roles }),
      })
      .where(eq(user.id, userId))
      .returning();

    if (!updatedUser) {
      throw notFound('User not found');
    }

    const permissionsByUser = await getUserPermissionsBulk([updatedUser.id]);

    return {
      ...updatedUser,
      displayName: updatedUser.nickname
        ? updatedUser.nickname
        : updatedUser.name || 'Unknown user',
      permissions: permissionsByUser.get(updatedUser.id) ?? [],
    };
  });
