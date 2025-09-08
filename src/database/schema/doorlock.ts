import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '~/database/helpers';
import { user } from '~/database/schema/authentication';

const DEFAULT_TTL_SECONDS = 30;

export const card = pgTable('card', {
  id: uuid('id').primaryKey().defaultRandom(),
  tag: text('tag').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  frozen: boolean('frozen').notNull().default(false),
  disabled: boolean('disabled').notNull().default(false),
  label: text('label'),
  ...timestamps,
});

// Physical door lock / access control device
// The device id should match the identifier used in the MQTT topic: filc/doorlock/<deviceId>/...
export const device = pgTable('device', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location'),
  // Last moment we received any event / heartbeat from the device
  lastSeenAt: timestamp('last_seen_at'),
  // How long (in seconds) the device considers itself online after lastSeenAt (a heartbeat TTL)
  ttlSeconds: integer('ttl_seconds').notNull().default(DEFAULT_TTL_SECONDS),
  status: text('status'), // optional free-form status (e.g. 'online', 'offline', 'degraded')
  ...timestamps,
});

// Many-to-many restriction between cards and devices.
// If a card has NO rows in this table, it is allowed on ALL devices.
// If it has one or more rows, it is restricted to ONLY those listed devices.
export const cardDevice = pgTable(
  'card_device',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => card.id, { onDelete: 'cascade' }),
    deviceId: text('device_id')
      .notNull()
      .references(() => device.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => ({
    pk: primaryKey({ columns: [t.cardId, t.deviceId] }),
  })
);

export const doorlockSchema = {
  card,
  device,
  cardDevice,
};
