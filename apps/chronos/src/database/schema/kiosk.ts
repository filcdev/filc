import { sql } from 'drizzle-orm';
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';

/**
 * A managed kiosk box. `machineId` is the box's own identity (DMI product
 * UUID, or a MAC fallback) and is what the unauthenticated heartbeat looks a
 * row up by; `kind` is validated in application code because its values live
 * in `@filcdev/api`.
 */
export const kiosk = pgTable('kiosk', {
  appVersion: text('app_version'),
  config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
  enabled: boolean('enabled').notNull().default(true),
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  lastSeenAt: timestamp('last_seen_at'),
  lastSeenIp: text('last_seen_ip'),
  machineId: text('machine_id').notNull().unique(),
  name: text('name').notNull(),
  ...timestamps,
});

export const kioskSchema = { kiosk };
