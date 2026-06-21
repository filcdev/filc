import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from '#database/schema/authentication';
import type { NotificationPreferences } from '#utils/notifications/types';

export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  language: text('language').default('hu').notNull(),
  notificationPreferences: jsonb('notification_preferences')
    .$type<NotificationPreferences>()
    .notNull()
    .default({
      announcement: true,
      blogPost: false,
      channelsEnabled: true,
      doorlockCardUsed: false,
      movedLesson: true,
      substitution: true,
      systemMessage: true,
    }),
  theme: text('theme').default('system').notNull(),
  timetableClassColors: jsonb('timetable_class_colors')
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  timetableView: text('timetable_view').default('class').notNull(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  ...timestamps,
});

export const notification = pgTable(
  'notification',
  {
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    id: uuid('id').primaryKey().defaultRandom(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    read: boolean('read').default(false).notNull(),
    title: text('title').notNull(),
    type: text('type').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('notification_user_id_created_at_idx').on(
      t.userId,
      t.createdAt.desc()
    ),
    index('notification_created_at_idx').on(t.createdAt),
  ]
);

export const fcmToken = pgTable('fcm_token', {
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deviceInfo: text('device_info'),
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const notificationsSchema = { fcmToken, notification, userPreferences };
