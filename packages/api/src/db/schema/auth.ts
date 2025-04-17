import {
  boolean,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const schema = pgSchema('auth')

export const user = schema.table(
  'user',
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    email: text().unique().notNull(),
    emailVerified: boolean(),
    image: text(),
    role: text(),
    banned: boolean(),
    banReason: text(),
    banExpires: timestamp(),
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
    impersonatedBy: text(),
    activeOrganizationId: text(),
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

export const organization = schema.table(
  'organization',
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    logo: text(),
    metadata: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  t => [uniqueIndex().on(t.slug)]
)

export const member = schema.table('member', {
  id: text().primaryKey().notNull(),
  userId: text()
    .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' })
    .notNull(),
  organizationId: text()
    .references(() => organization.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    })
    .notNull(),
  role: text().notNull(),
  teamId: text(),
  createdAt: timestamp().notNull().defaultNow(),
})

export const invitation = schema.table(
  'invitation',
  {
    id: text().primaryKey().notNull(),
    email: text().notNull(),
    inviterId: text()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    organizationId: text()
      .references(() => organization.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    role: text().notNull(),
    status: text().notNull(),
    teamId: text(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  t => [uniqueIndex().on(t.email), uniqueIndex().on(t.organizationId)]
)

export const team = schema.table('team', {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  organizationId: text()
    .references(() => organization.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    })
    .notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const authSchema = {
  user,
  session,
  account,
  verification,
}
