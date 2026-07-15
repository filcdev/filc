import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from './authentication';

/**
 * API keys let users (or the aegis doorlock) authenticate against the backend
 * without a browser session cookie. The raw key is only ever returned once at
 * creation time; we persist a SHA-256 hash of it and a short, non-secret
 * prefix used purely for display/identification in listings.
 */
export const apiKey = pgTable(
  'api_key',
  {
    expiresAt: timestamp('expires_at'),
    id: uuid('id').primaryKey().defaultRandom(),
    keyHash: text('key_hash').notNull().unique(),
    lastUsedAt: timestamp('last_used_at'),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    index('api_key_user_id_idx').on(t.userId),
    index('api_key_key_hash_idx').on(t.keyHash),
  ]
);

export const apiKeySchema = {
  apiKey,
};
