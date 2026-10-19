import { permissions } from '@filcdev/api/permissions';
import { arrayContains, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import {
  diffActivity,
  recordActivity,
} from '#modules/activity-log/utils/record';
import { base } from '#orpc';
import { getUserPermissionsBulk } from '#utils/authorization';
import { notFound } from '#utils/http';

export const listUsers = base.users.list
  .use(requireAuthorization(permissions.usersRead))
  .handler(async ({ input }) => {
    const { limit, offset, role, search } = input;

    const whereClause = or(
      search
        ? or(
            ilike(user.name, `%${search}%`),
            ilike(user.email, `%${search}%`),
            ilike(user.nickname, `%${search}%`)
          )
        : undefined,
      role ? arrayContains(user.roles, [role]) : undefined
    );

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

    return { items: users, total: countResult?.count ?? 0 };
  });

export const updateUser = base.users.update
  .use(requireAuthorization(permissions.usersManage))
  .handler(async ({ context, input }) => {
    const { id: userId, cohortId, nickname, roles } = input;

    const [before] = await db
      .select({
        cohortId: user.cohortId,
        nickname: user.nickname,
        roles: user.roles,
      })
      .from(user)
      .where(eq(user.id, userId));

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

    if (before) {
      const diff = diffActivity(before, { cohortId, nickname, roles }, [
        'cohortId',
        'nickname',
        'roles',
      ]);
      if (diff) {
        await recordActivity(context, {
          action: 'update',
          entityId: userId,
          entityType: 'user',
          metadata: diff,
        });
      }
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
