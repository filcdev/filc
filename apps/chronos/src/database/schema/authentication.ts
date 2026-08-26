import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  cohortId: text('cohort_id'),
  createdAt: timestamp('created_at').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
  image: text('image'),
  name: text('name').notNull(),
  nickname: text('nickname'),
  roles: text('roles').array().notNull(),
  updatedAt: timestamp('updated_at')
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    createdAt: timestamp('created_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    ipAddress: text('ip_address'),
    token: text('token').notNull().unique(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
  'account',
  {
    accessToken: text('access_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    accountId: text('account_id').notNull(),
    createdAt: timestamp('created_at').notNull(),
    id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    idToken: text('id_token'),
    issuer: text('issuer').notNull(),
    password: text('password'),
    providerId: text('provider_id').notNull(),
    refreshToken: text('refresh_token'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('account_issuer_accountId_uidx').on(
      table.issuer,
      table.accountId
    ),
    index('account_userId_idx').on(table.userId),
  ]
);

export const verification = pgTable(
  'verification',
  {
    createdAt: timestamp('created_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    id: uuid('id').default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    identifier: text('identifier').notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    value: text('value').notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const authenticationSchema = {
  account,
  session,
  user,
  verification,
};
