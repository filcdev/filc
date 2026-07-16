import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '#database';
import { apiKey } from '#database/schema/api-keys';
import { user } from '#database/schema/authentication';
import { getUserPermissions } from '#utils/authorization';

const logger = getLogger(['chronos', 'api-keys']);

const KEY_PREFIX_LENGTH = 8;
const KEY_RANDOM_BYTES = 32;
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const BEARER_REGEX = /^Bearer\s+(.+)$/i;

/**
 * Generate a new API key. The returned `key` is the only time the raw secret
 * is available — callers must surface it to the user immediately. We store a
 * scrypt-derived key (with a per-key random salt) plus a short, non-secret
 * prefix for later identification. The stored value has the form
 * `salt:keyHex` so the salt is persisted alongside the derived key.
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

  const hash = hashApiKey(key);

  return { hash, key, prefix };
};

/**
 * Derive a stored representation of an API key using scrypt with a per-key
 * random salt. Returns `salt:keyHex` where both halves are hex-encoded. The
 * salt is required at validation time, so it is persisted with the derived
 * key. Scrypt provides far more computational effort than a plain SHA-256
 * hash, which is what makes it suitable for credential storage.
 */
export const hashApiKey = (key: string): string => {
  const salt = randomBytes(16);
  const derived = scryptSync(key, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    p: SCRYPT_PARALLELIZATION,
    r: SCRYPT_BLOCK_SIZE,
  });

  return `${salt.toString('hex')}:${derived.toString('hex')}`;
};

/**
 * Verify a raw API key against a stored `salt:keyHex` representation using a
 * constant-time comparison to avoid timing side-channels.
 */
const verifyApiKey = (key: string, stored: string): boolean => {
  const [saltHex, keyHex] = stored.split(':');
  if (!(saltHex && keyHex)) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');
  const derived = scryptSync(key, salt, expected.length, {
    N: SCRYPT_COST,
    p: SCRYPT_PARALLELIZATION,
    r: SCRYPT_BLOCK_SIZE,
  });

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
};

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
  // Scrypt is non-reversible, so we cannot query by a recomputed hash. Load
  // candidate keys for the prefix (a cheap, non-secret filter) and verify the
  // raw key against each stored `salt:keyHex` value in constant time.
  const prefix = key.split('.')[0]?.slice(0, KEY_PREFIX_LENGTH);
  if (!prefix) {
    return null;
  }

  const records = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.prefix, prefix))
    .limit(20);

  const record = records.find((r) => verifyApiKey(key, r.keyHash));
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
