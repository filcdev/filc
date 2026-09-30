import { getLogger } from '@logtape/logtape';
import { ORPCError } from '@orpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '#database';
import { apiKey } from '#database/schema/api-keys';
import { requireAuthentication } from '#middleware/auth';
import { base } from '#orpc';
import { generateApiKey } from '#utils/api-keys';
import { notFound } from '#utils/http';

const logger = getLogger(['chronos', 'users', 'api-keys']);

// Never leak the hash or the raw key in listings: the rows are projected to
// exactly the fields the contract exposes.
const apiKeyColumns = {
  createdAt: apiKey.createdAt,
  expiresAt: apiKey.expiresAt,
  id: apiKey.id,
  lastUsedAt: apiKey.lastUsedAt,
  name: apiKey.name,
  prefix: apiKey.prefix,
  updatedAt: apiKey.updatedAt,
  userId: apiKey.userId,
};

export const listApiKeysRoute = base.users.me.apiKeys.list
  .use(requireAuthentication)
  .handler(async ({ context }) => {
    const session = context.session;

    const keys = await db
      .select(apiKeyColumns)
      .from(apiKey)
      .where(eq(apiKey.userId, session.userId))
      .orderBy(desc(apiKey.createdAt));

    return { apiKeys: keys };
  });

export const createApiKeyRoute = base.users.me.apiKeys.create
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const session = context.session;

    const { name, expiresAt } = input;
    const { hash, key, prefix } = generateApiKey();

    const [inserted] = await db
      .insert(apiKey)
      .values({
        expiresAt: expiresAt ?? null,
        keyHash: hash,
        name,
        prefix,
        userId: session.userId,
      })
      .returning(apiKeyColumns);

    if (!inserted) {
      throw new ORPCError('INTERNAL', { message: 'Failed to create API key' });
    }

    logger.info('Created API key', {
      id: inserted.id,
      userId: session.userId,
    });

    return { apiKey: inserted, rawKey: key };
  });

export const revokeApiKeyRoute = base.users.me.apiKeys.delete
  .use(requireAuthentication)
  .handler(async ({ context, input }) => {
    const session = context.session;
    const { id } = input;

    const [deleted] = await db
      .delete(apiKey)
      .where(and(eq(apiKey.id, id), eq(apiKey.userId, session.userId)))
      .returning({ id: apiKey.id });

    if (!deleted) {
      throw notFound('API key not found');
    }

    logger.info('Revoked API key', { id, userId: session.userId });

    return { id: deleted.id };
  });
