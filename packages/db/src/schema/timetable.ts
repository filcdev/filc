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
import { enumToPgEnum } from '../utils'
import { user } from './auth'

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
    classMasterId: uuid()
      .notNull()
      .references(() => teacher.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    secondaryClassMasterId: uuid()
      .notNull()
      .references(() => teacher.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    headquartersRoomId: uuid()
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
    cohortId: uuid()
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
    subjectId: uuid()
      .notNull()
      .references(() => subject.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    teacherId: uuid()
      .notNull()
      .references(() => teacher.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    cohortId: uuid()
      .notNull()
      .references(() => cohort.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    roomId: uuid()
      .notNull()
      .references(() => room.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  t => [uniqueIndex().on(t.weekType, t.day, t.subjectId, t.teacherId, t.cohortId)]
)

export const lessonPeriod = schema.table(
  'lesson_period',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    lessonId: uuid()
      .notNull()
      .references(() => lesson.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    periodId: uuid()
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
  lessonId: uuid()
    .notNull()
    .references(() => lesson.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  teacherId: uuid().references(() => teacher.id, {
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
