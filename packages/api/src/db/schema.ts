import {
  boolean,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const schema = pgSchema('filc')

export const user = schema.table(
  'user',
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().unique().notNull(),
    emailVerified: boolean(),
    image: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.email)]
)

export const session = schema.table(
  'session',
  {
    id: text().primaryKey().notNull(),
    userId: text()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    token: text().notNull(),
    expiresAt: timestamp().notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.token), uniqueIndex().on(t.userId)]
)

export const account = schema.table(
  'account',
  {
    id: text().primaryKey().notNull(),
    userId: text()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    idToken: text(),
    password: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.userId)]
)

export const verification = schema.table(
  'verification',
  {
    id: text().primaryKey().notNull(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.identifier)]
)
