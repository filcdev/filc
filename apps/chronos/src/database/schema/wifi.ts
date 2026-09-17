import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from './authentication';

/**
 * WiFi user accounts
 * Represents both Entra-linked and manually-created WiFi accounts
 */
export const wifiUser = pgTable(
  'wifi_user',
  {
    allowedMacAddresses: text('allowed_mac_addresses').array(),
    banned: boolean('banned').default(false).notNull(),
    comment: text('comment'),
    createdBy: uuid('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    encryptedPassword: text('encrypted_password').notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    salt: text('salt').notNull(),
    speedProfileId: text('speed_profile_id'),
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    username: text('username').notNull().unique(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('wifi_user_username_idx').on(t.username),
    index('wifi_user_user_id_idx').on(t.userId),
  ]
);

/**
 * WiFi devices (client MACs)
 * Unified table for assigned devices and global MAC banlist
 * Serves both user-owned devices and system-wide ban entries
 */
export const wifiDevice = pgTable(
  'wifi_device',
  {
    adminNotes: text('admin_notes'),
    banned: boolean('banned').default(false).notNull(),
    id: uuid('id').primaryKey().defaultRandom(),
    lastActiveAt: timestamp('last_active_at'),
    macAddress: text('mac_address').notNull().unique(),
    nickname: text('nickname'),
    reportedHostname: text('reported_hostname'),
    wifiUserId: uuid('wifi_user_id').references(() => wifiUser.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('wifi_device_mac_address_idx').on(t.macAddress),
    index('wifi_device_wifi_user_id_idx').on(t.wifiUserId),
  ]
);

/**
 * Network Access Servers (FreeRADIUS-connected APs)
 * Registry of authorized access points
 */
export const wifiNas = pgTable(
  'wifi_nas',
  {
    comment: text('comment'),
    id: uuid('id').primaryKey().defaultRandom(),
    ipAddress: text('ip_address').notNull(),
    macAddress: text('mac_address').notNull().unique(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('wifi_nas_mac_address_idx').on(t.macAddress),
    uniqueIndex('wifi_nas_ip_address_idx').on(t.ipAddress),
  ]
);

/**
 * WiFi authentication log
 * Audit trail for all RADIUS auth attempts (accept and reject)
 * Used for troubleshooting, stats, and retention policies
 */
export const wifiAuthLog = pgTable(
  'wifi_auth_log',
  {
    failureReason: text('failure_reason'),
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    macAddress: text('mac_address').notNull(),
    nasIpAddress: text('nas_ip_address'),
    nasMacAddress: text('nas_mac_address'),
    result: boolean('result').notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    username: text('username').notNull(),
    wifiUserId: uuid('wifi_user_id').references(() => wifiUser.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('wifi_auth_log_timestamp_idx').on(t.timestamp),
    index('wifi_auth_log_username_idx').on(t.username),
    index('wifi_auth_log_mac_address_idx').on(t.macAddress),
  ]
);

/**
 * Role-based speed profile mappings
 * Maps filc RBAC roles to UniFi speed profile IDs with configurable limits
 * Used at auth time to resolve effective speed limits
 */
export const wifiRoleSpeedProfile = pgTable(
  'wifi_role_speed_profile',
  {
    priority: integer('priority').default(0).notNull(),
    roleName: text('role_name').primaryKey(),
    speedProfileId: text('speed_profile_id')
      .notNull()
      .references(() => wifiSpeedProfile.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index('wifi_role_speed_profile_role_name_idx').on(t.roleName)]
);

export const wifiSpeedProfile = pgTable('wifi_speed_profile', {
  downloadSpeedMbps: integer('download_speed_mbps'),
  id: text('id').primaryKey(),
  isWlanDefault: boolean('is_wlan_default').default(false).notNull(),
  name: text('name').notNull(),
  syncedAt: timestamp('synced_at').notNull().defaultNow(),
  uploadSpeedMbps: integer('upload_speed_mbps'),
});

export const wifiSchema = {
  wifiAuthLog,
  wifiDevice,
  wifiNas,
  wifiRoleSpeedProfile,
  wifiSpeedProfile,
  wifiUser,
};
