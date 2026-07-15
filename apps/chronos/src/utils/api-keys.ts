import { createHash } from 'node:crypto';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { apiKey } from '#database/schema/api-keys';
import { user } from '#database/schema/authentication';
import { getUserPermissions } from '#utils/authorization';

const logger = getLogger(['chronos', 'api-keys']);

const KEY_PREFIX_LENGTH = 8;
const KEY_RANDOM_BYTES = 32;
const BEARER_REGEX = /^Bearer\s+(.+)$/i;

/**
 * Generate a new API key. The returned `key` is the only time the raw secret
 * is available — callers must surface it to the user immediately. We store a
 * SHA-256 hash plus a short, non-secret prefix for later identification.
 */
export const generateApiKey = (): {
  hash: string;
  key: string;
  prefix: string;
} => {
  const random = crypto.getRandomValues(new Uint8Array(KEY_RANDOM_BYTES));
  const secret = Array.from(random, (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
  const prefix = secret.slice(0, KEY_PREFIX_LENGTH);
  const key = `${prefix}.${secret}`;

  const hashHex = hashApiKey(key);

  return { hash: hashHex, key, prefix };
};

/** Hash an API key the same way it is stored, for validation. */
export const hashApiKey = (key: string): string =>
  createHash('sha256').update(key).digest('hex');

export type ApiKeyUser = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  roles: string[];
  displayName: string;
  permissions: string[];
};

/**
 * Validate a raw API key. Returns the owning user (augmented with the same
 * shape the session middleware produces) when the key exists, is not expired
 * and belongs to an existing user. On success the key's `lastUsedAt` is bumped.
 */
export const validateApiKey = async (
  key: string
): Promise<ApiKeyUser | null> => {
  const keyHash = hashApiKey(key);

  const [record] = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.keyHash, keyHash))
    .limit(1);

  if (!record) {
    return null;
  }

  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    logger.debug('Rejected expired API key', { id: record.id });
    return null;
  }

  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.id, record.userId))
    .limit(1);

  if (!owner) {
    return null;
  }

  await db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, record.id));

  const permissions = await getUserPermissions(owner.id);

  return {
    ...owner,
    displayName: owner.nickname ? owner.nickname : owner.name || 'Unknown user',
    permissions,
  };
};

/** Extract a raw API key from the common header conventions. */
export const extractApiKey = (headers: Headers): string | null => {
  const authorization = headers.get('authorization');
  if (authorization) {
    const match = BEARER_REGEX.exec(authorization.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const xApiKey = headers.get('x-api-key');
  if (xApiKey) {
    return xApiKey.trim();
  }

  return null;
};
