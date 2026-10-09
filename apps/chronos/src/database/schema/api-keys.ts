import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * The `apikey` table owned by better-auth's official `@better-auth/api-key`
 * plugin.
 *
 * Better Auth writes this table itself through the Drizzle adapter, so the
 * column names and types mirror the plugin's own schema declaration
 * (`apiKeySchema` in `@better-auth/api-key`) rather than being derived from a
 * Drizzle source of truth. Two details are load-bearing:
 *
 * - `key` stores the *hashed* key. The plugin hashes with SHA-256 and looks a
 *   key up by its hash directly, so the column is indexed and must stay unique
 *   enough to be the lookup path.
 * - `referenceId` is the owning user (or organization) id. It replaced the old
 *   `userId` column in the plugin's own schema, and the owner type is decided
 *   by the configuration's `references` setting, not stored per row.
 *
 * `user` is deliberately NOT declared as a foreign key: Better Auth manages
 * this table's lifecycle (including deleting expired rows on its own schedule)
 * and the plugin's schema does not declare a relation. A cascade FK would make
 * the plugin's own deletes fight the database's.
 */
export const apikey = pgTable(
  'apikey',
  {
    configId: text('config_id').default('default').notNull(),
    createdAt: timestamp('created_at').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    expiresAt: timestamp('expires_at'),
    id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    key: text('key').notNull(),
    lastRefillAt: timestamp('last_refill_at'),
    lastRequest: timestamp('last_request'),
    metadata: text('metadata'),
    name: text('name'),
    permissions: text('permissions'),
    prefix: text('prefix'),
    rateLimitEnabled: boolean('rate_limit_enabled').default(true).notNull(),
    rateLimitMax: integer('rate_limit_max'),
    rateLimitTimeWindow: integer('rate_limit_time_window'),
    referenceId: text('reference_id').notNull(),
    refillAmount: integer('refill_amount'),
    refillInterval: integer('refill_interval'),
    remaining: integer('remaining'),
    requestCount: integer('request_count').default(0).notNull(),
    start: text('start'),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [
    index('apikey_config_id_idx').on(t.configId),
    index('apikey_key_idx').on(t.key),
    index('apikey_reference_id_idx').on(t.referenceId),
  ]
);

export const apiKeySchema = {
  apikey,
};
