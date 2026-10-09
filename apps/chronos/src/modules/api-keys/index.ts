import { permissions } from '@filcdev/api/permissions';
import { and, count, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm';
import { db } from '#database';
import { apikey } from '#database/schema/api-keys';
import { user } from '#database/schema/authentication';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { notFound } from '#utils/http';

/**
 * Admin view over the better-auth `apikey` table.
 *
 * The rows belong to the plugin, so this module only ever reads them and
 * flips the `enabled` flag — it never writes a key, and it never selects the
 * hashed `key` column, because nothing here needs it. The join to `user`
 * supplies the owner's name and email for the list.
 *
 * Deleting here is deliberately not delegated to better-auth's
 * `deleteApiKey`, which rejects a key the calling session does not own: an
 * admin revoking someone else's key is the whole point of the screen.
 */

/** The columns the admin list renders; the hashed key is not among them. */
const adminApiKeyColumns = {
  createdAt: apikey.createdAt,
  enabled: apikey.enabled,
  expiresAt: apikey.expiresAt,
  id: apikey.id,
  lastRequest: apikey.lastRequest,
  name: apikey.name,
  ownerEmail: user.email,
  ownerName: user.name,
  prefix: apikey.prefix,
  referenceId: apikey.referenceId,
  requestCount: apikey.requestCount,
  start: apikey.start,
  updatedAt: apikey.updatedAt,
};

export const listAdminApiKeys = base.adminApiKeys.list
  .use(requireAuthorization(permissions.usersManage))
  .handler(async ({ input }) => {
    const { limit, offset, ownerId, search } = input;

    // `referenceId` is a text column and cannot be compared to a uuid
    // parameter directly, so the owner filter is cast to text.
    const ownerFilter = ownerId
      ? sql`${apikey.referenceId} = ${ownerId}`
      : undefined;
    const searchFilter = search
      ? or(
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
          ilike(apikey.name, `%${search}%`)
        )
      : undefined;
    const whereClause = and(ownerFilter, searchFilter) as SQL | undefined;

    const apiKeys = await db
      .select(adminApiKeyColumns)
      .from(apikey)
      .innerJoin(user, sql`${apikey.referenceId} = ${user.id}::text`)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(apikey.createdAt));

    const [totalRow] = await db
      .select({ count: count() })
      .from(apikey)
      .innerJoin(user, sql`${apikey.referenceId} = ${user.id}::text`)
      .where(whereClause);

    return { apiKeys, total: totalRow?.count ?? 0 };
  });

export const updateAdminApiKey = base.adminApiKeys.update
  .use(requireAuthorization(permissions.usersManage))
  .handler(async ({ input }) => {
    const { enabled, keyId } = input;

    const [updated] = await db
      .update(apikey)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(apikey.id, keyId))
      .returning({ id: apikey.id });

    if (!updated) {
      throw notFound('API key not found');
    }

    const [row] = await db
      .select(adminApiKeyColumns)
      .from(apikey)
      .innerJoin(user, sql`${apikey.referenceId} = ${user.id}::text`)
      .where(eq(apikey.id, keyId))
      .limit(1);

    if (!row) {
      throw notFound('API key not found');
    }

    return row;
  });

export const deleteAdminApiKey = base.adminApiKeys.delete
  .use(requireAuthorization(permissions.usersManage))
  .handler(async ({ input }) => {
    const { keyId } = input;

    const [deleted] = await db
      .delete(apikey)
      .where(eq(apikey.id, keyId))
      .returning({ id: apikey.id });

    if (!deleted) {
      throw notFound('API key not found');
    }

    return { id: deleted.id };
  });
