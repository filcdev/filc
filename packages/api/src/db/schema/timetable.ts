import {
  char,
  integer,
  pgEnum,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { enumToPgEnum } from '../utils'
import { relations } from 'drizzle-orm'

export const schema = pgSchema('timetable')

export const room = schema.table(
    'room',
    {
        id: text().primaryKey().notNull(),
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
        id: text().primaryKey().notNull(),
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
        id: text().primaryKey().notNull(),
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
        id: text().primaryKey().notNull(),
        year: integer().notNull(),
        designation: char().notNull(),
        classMaster: text().notNull().references(
            () => teacher.id,
            { onDelete: 'cascade', onUpdate: 'cascade' }
        ),
        secondaryClassMaster: text().notNull().references(
            () => teacher.id,
            { onDelete: 'cascade', onUpdate: 'cascade' }
        ),
        headquarters: text().notNull().references(
            () => room.id,
            { onDelete: 'cascade', onUpdate: 'cascade' }
        ),
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
        id: text().primaryKey().notNull(),
        name: text().notNull(),
        cohort: text().notNull().references(
            () => cohort.id,
            { onDelete: 'cascade', onUpdate: 'cascade' }
        ),
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
    ALL = 'all',
    NONE = 'none',
}

export const weekType = pgEnum(
    'week_type',
    enumToPgEnum(WeekType)
)

export enum Day {
    MONDAY = 'monday',
    TUESDAY = 'tuesday',
    WEDNESDAY = 'wednesday',
    THURSDAY = 'thursday',
    FRIDAY = 'friday',
    SATURDAY = 'saturday',
    SUNDAY = 'sunday',
}

export const day = pgEnum(
    'day',
    enumToPgEnum(Day)
)

export const period = schema.table(
    'period',
    {
        id: text().primaryKey().notNull(),
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
        id: text().primaryKey().notNull(),
        weekType: weekType().notNull(),
        day: day().notNull(),
        period: text().notNull().references(
            () => period.id,
            { onDelete: 'cascade', onUpdate: 'cascade' }
        ),
        subject: text().notNull().references(
            () => subject.id,
            { onDelete: 'cascade', onUpdate: 'cascade' }
        ),
        teacher: text().notNull().references(
            () => teacher.id,
            { onDelete: 'cascade', onUpdate: 'cascade' }
        ),
        cohort: text().notNull().references(
            () => cohort.id,
            { onDelete: 'cascade', onUpdate: 'cascade' }
        ),
        room: text().notNull().references(
            () => room.id,
            { onDelete: 'cascade', onUpdate: 'cascade' }
        ),
        createdAt: timestamp().notNull().defaultNow(),
        updatedAt: timestamp()
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
    },
    t => [uniqueIndex().on(t.weekType, t.day, t.period, t.subject, t.teacher, t.cohort)]
)

export const lessonRelations = relations(lesson, ({ many }) => ({
    groups: many(group),
}))

export const cohortRelations = relations(cohort, ({ many }) => ({
    students: many(user),
}))