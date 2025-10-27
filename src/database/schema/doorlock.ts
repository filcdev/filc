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

export const card = pgTable('card', {
  disabled: boolean('disabled').notNull().default(false),
  frozen: boolean('frozen').notNull().default(false),
  id: uuid('id').primaryKey().defaultRandom(),
  label: text('label'),
  tag: text('tag').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  ...timestamps,
});

const DEVICE_DEFAULT_TTL_SECONDS = 30;

// Physical door lock / access control device
// The device id should match the identifier used in the MQTT topic: filc/doorlock/<deviceId>/...
export const device = pgTable('device', {
  id: text('id').primaryKey(),
  // Last moment we received any event / heartbeat from the device
  lastSeenAt: timestamp('last_seen_at'),
  location: text('location'),
  name: text('name').notNull(),
  status: text('status'), // optional free-form status (e.g. 'online', 'offline', 'degraded')
  // How long (in seconds) the device considers itself online after lastSeenAt (a heartbeat TTL)
  ttlSeconds: integer('ttl_seconds')
    .notNull()
    .default(DEVICE_DEFAULT_TTL_SECONDS),
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

// Access log for all card scan attempts
export const accessLog = pgTable('access_log', {
  // Card ID if the tag was found in the system
  cardId: uuid('card_id').references(() => card.id, { onDelete: 'set null' }),
  deviceId: text('device_id')
    .notNull()
    .references(() => device.id, { onDelete: 'cascade' }),
  id: uuid('id').primaryKey().defaultRandom(),
  // Reason for denial (if denied)
  reason: text('reason'),
  // Result of the access attempt
  result: text('result').notNull(), // 'granted', 'denied'
  // Tag scanned (may not exist in card table if unknown)
  tag: text('tag').notNull(),
  // Timestamp of the access attempt
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  // User ID associated with the card at the time of scan
  userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
  ...timestamps,
});

export const doorlockSchema = {
  accessLog,
  card,
  cardDevice,
  device,
};
