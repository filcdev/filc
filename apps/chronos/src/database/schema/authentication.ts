import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '@/database/helpers';
import { cohort } from '@/database/schema/timetable';

export const user = pgTable('user', {
  cohortId: text('cohort_id').references(() => cohort.id),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified')
    .$defaultFn(() => !1)
    .notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  image: text('image'),
  name: text('name').notNull(),
  nickname: text('nickname'),
  roles: jsonb('roles').$type<string[]>().notNull().default(['user']),
  ...timestamps,
});

export const session = pgTable('session', {
  createdAt: timestamp('created_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  ipAddress: text('ip_address'),
  token: text('token').notNull().unique(),
  updatedAt: timestamp('updated_at').notNull(),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  accessToken: text('access_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  accountId: text('account_id').notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  idToken: text('id_token'),
  password: text('password'),
  providerId: text('provider_id').notNull(),
  refreshToken: text('refresh_token'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  ...timestamps,
});

export const verification = pgTable('verification', {
  expiresAt: timestamp('expires_at').notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  ...timestamps,
});

export const authenticationSchema = {
  account,
  session,
  user,
  verification,
};
