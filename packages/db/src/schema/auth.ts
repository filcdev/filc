import { relations } from 'drizzle-orm'
import {
  boolean,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { cohort } from './timetable'

export const schema = pgSchema('auth')

export const user = schema.table(
  'user',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    email: text().unique().notNull(),
    emailVerified: boolean(),
    image: text(),
    role: text(),
    banned: boolean(),
    banReason: text(),
    banExpires: timestamp(),
    cohortId: uuid(),
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
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    token: text().notNull(),
    expiresAt: timestamp().notNull(),
    ipAddress: text(),
    userAgent: text(),
    impersonatedBy: uuid(),
    activeOrganizationId: uuid(),
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
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid()
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
    id: uuid().defaultRandom().primaryKey().notNull(),
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
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    logo: text(),
    metadata: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  t => [uniqueIndex().on(t.slug)]
)

export const member = schema.table('member', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid()
    .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' })
    .notNull(),
  organizationId: uuid()
    .references(() => organization.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    })
    .notNull(),
  role: text().notNull(),
  teamId: uuid().references(() => team.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  createdAt: timestamp().notNull().defaultNow(),
})

export const invitation = schema.table(
  'invitation',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    email: text().notNull(),
    inviterId: uuid()
      .references(() => user.id, { onDelete: 'cascade', onUpdate: 'cascade' })
      .notNull(),
    organizationId: uuid()
      .references(() => organization.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    role: text().notNull(),
    status: text().notNull(),
    teamId: uuid().references(() => team.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  t => [uniqueIndex().on(t.email), uniqueIndex().on(t.organizationId)]
)

export const team = schema.table(
  'team',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    organizationId: uuid()
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
  },
  t => [uniqueIndex().on(t.name)]
)

export const userRelations = relations(user, ({ one }) => ({
  cohort: one(cohort, {
    fields: [user.cohortId],
    references: [cohort.id],
    relationName: 'timetable_cohort_students'
  })
}))

export const authSchema = {
  user,
  session,
  account,
  verification,
  team,
}
