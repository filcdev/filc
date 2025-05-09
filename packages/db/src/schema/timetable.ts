import { user } from '@/schema/auth'
import { enumToPgEnum } from '@/utils'
import { relations } from 'drizzle-orm'
import {
  boolean,
  char,
  integer,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const schema = pgSchema('timetable')

export const room = schema.table(
  'room',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    shortName: text().notNull(),
    capacity: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.name), uniqueIndex().on(t.shortName)]
)

export const subject = schema.table(
  'subject',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    shortName: text().notNull(),
    icon: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.name)]
)

export const teacher = schema.table(
  'teacher',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    shortName: text().notNull(),
    email: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.name), uniqueIndex().on(t.email)]
)

export const cohort = schema.table(
  'cohort',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    year: integer().notNull(),
    designation: char().notNull(),
    classMaster: text()
      .notNull()
      .references(() => teacher.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    secondaryClassMaster: text()
      .notNull()
      .references(() => teacher.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    headquarters: text()
      .notNull()
      .references(() => room.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.year, t.designation)]
)

export const group = schema.table(
  'group',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    cohort: text()
      .notNull()
      .references(() => cohort.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.name)]
)

export enum WeekType {
  A = 'a',
  B = 'b',
  All = 'all',
  None = 'none',
}

export const weekType = pgEnum('week_type', enumToPgEnum(WeekType))

export enum Day {
  Monday = 'monday',
  Tuesday = 'tuesday',
  Wednesday = 'wednesday',
  Thursday = 'thursday',
  Friday = 'friday',
  Saturday = 'saturday',
  Sunday = 'sunday',
}

export const day = pgEnum('day', enumToPgEnum(Day))

export const period = schema.table(
  'period',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    startTime: timestamp().notNull(),
    endTime: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.startTime, t.endTime)]
)

export const lesson = schema.table(
  'lesson',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    weekType: weekType().notNull(),
    day: day().notNull(),
    subject: text()
      .notNull()
      .references(() => subject.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    teacher: text()
      .notNull()
      .references(() => teacher.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    cohort: text()
      .notNull()
      .references(() => cohort.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    room: text()
      .notNull()
      .references(() => room.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.weekType, t.day, t.subject, t.teacher, t.cohort)]
)

export const lessonPeriod = schema.table(
  'lesson_period',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    lessonId: text()
      .notNull()
      .references(() => lesson.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    periodId: text()
      .notNull()
      .references(() => period.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    isStart: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.lessonId, t.periodId)]
)

export const substitution = schema.table('substitution', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  lesson: text()
    .notNull()
    .references(() => lesson.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  teacher: text().references(() => teacher.id, {
    onDelete: 'cascade',
    onUpdate: 'cascade',
  }),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const timetable = schema.table(
  'timetable',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    validFrom: timestamp().notNull(),
    validTo: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.name)]
)

export const timetableDay = schema.table('timetable_day', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  day: day().notNull(),
})

export const timetableDayRelations = relations(timetableDay, ({ many }) => ({
  lessons: many(lesson),
}))

export const timetableRelations = relations(timetable, ({ many }) => ({
  days: many(timetableDay),
}))

export const lessonRelations = relations(lesson, ({ many }) => ({
  groups: many(group),
  periods: many(lessonPeriod),
}))

export const periodRelations = relations(period, ({ many }) => ({
  lessons: many(lessonPeriod),
}))

export const lessonPeriodRelations = relations(lessonPeriod, ({ one }) => ({
  lesson: one(lesson, {
    fields: [lessonPeriod.lessonId],
    references: [lesson.id],
  }),
  period: one(period, {
    fields: [lessonPeriod.periodId],
    references: [period.id],
  }),
}))

export const cohortRelations = relations(cohort, ({ many }) => ({
  students: many(user),
}))
