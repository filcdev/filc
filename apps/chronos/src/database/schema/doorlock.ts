import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from './authentication';

export const device = pgTable('device', {
  apiToken: text('api_token').notNull().unique(),
  id: uuid('id').primaryKey().defaultRandom(),
  lastResetReason: text('last_reset_reason'),
  location: text('location'),
  name: text('name').notNull(),
  ...timestamps,
});

export const card = pgTable('card', {
  cardData: text('card_uid').notNull().unique(),
  enabled: boolean('enabled').default(true).notNull(),
  frozen: boolean('frozen').default(false).notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  ...timestamps,
});

export const cardDevice = pgTable(
  'card_device',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => card.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => device.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.cardId, t.deviceId] }),
    index('card_device_card_id_idx').on(t.cardId),
    index('card_device_device_id_idx').on(t.deviceId),
  ]
);

export const deviceHealth = pgTable('device_health', {
  deviceId: uuid('device_id')
    .notNull()
    .references(() => device.id, { onDelete: 'cascade' }),
  deviceMeta: jsonb('device_meta')
    .$type<{
      fwVersion: string;
      uptime: bigint;
      ramFree: bigint;
      storage: {
        total: bigint;
        used: bigint;
      };
      debug: {
        lastResetReason: string;
        deviceState: 'booting' | 'error' | 'idle' | 'updating';
        errors: {
          nfc: boolean;
          sd: boolean;
          wifi: boolean;
          db: boolean;
          ota: boolean;
        };
      };
    }>()
    .notNull(),
  id: serial('id').primaryKey(),
  timestamp: timestamps.createdAt,
});

export const auditLog = pgTable('audit_log', {
  buttonPressed: boolean('button_pressed').notNull(),
  cardData: text('card_data'),
  cardId: uuid('card_id').references(() => card.id, { onDelete: 'set null' }),
  deviceId: uuid('device_id')
    .notNull()
    .references(() => device.id, { onDelete: 'cascade' }),
  id: serial('id').primaryKey(),
  result: boolean('result').notNull(),
  timestamp: timestamps.createdAt,
  userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
});

export const doorlockSchema = {
  auditLog,
  card,
  cardDevice,
  device,
  deviceHealth,
};
