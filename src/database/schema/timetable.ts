import {
  bit,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '~/database/helpers';
import { user } from '~/database/schema/authentication';

export const period = pgTable('period', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  period: integer('period').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  ...timestamps,
});

export const dayDefinition = pgTable('day_definition', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  days: jsonb('days').$type<string[]>(),
  ...timestamps,
});

// TODO: rewiew whether this column is necessary
export const weekDefinition = pgTable('week_definition', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  weeks: jsonb('weeks').$type<string[]>(),
  ...timestamps,
});

export const termDefinition = pgTable('term_definition', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  terms: jsonb('terms').$type<string[]>(),
  ...timestamps,
});

export const subject = pgTable('subject', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  ...timestamps,
});

export const teacher = pgTable('teacher', {
  id: text('id').primaryKey(),
  linkedUserId: uuid('linked_user_id').references(() => user.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  short: text('short').notNull(),
  gender: bit({ dimensions: 1 }),
});

export const building = pgTable('building', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const classroom = pgTable('classroom', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  buildingId: text('building_id')
    .notNull()
    .references(() => building.id),
  capacity: integer('capacity').notNull(),
});

// export const grade = pgTable('grade', {
//   id: text('id').primaryKey(),
//   name: text('name').notNull(),
//   short: text('short').notNull(),
//   grade: integer('grade').notNull(),
// });

export const cohort = pgTable('cohort', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  teacherId: text('teacher_id').references(() => teacher.id),
  // TODO: review if we need to store multiple classrooms
  classroomIds: jsonb('classroom_ids').$type<string[]>(),
  // TODO: review if school uses this
  // grade: integer('grade').notNull();
});

export const cohortGroup = pgTable('group', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cohortId: text('cohort_id')
    .notNull()
    .references(() => cohort.id),
  entireClass: boolean('entire_class').notNull(),
  teacherId: text('teacher_id').references(() => teacher.id),
  // TODO: figure out what this does
  // divisionTag: integer('division_tag'),
  // TODO: review if school uses this
  studentCount: integer('student_count').notNull(),
});

export const lesson = pgTable('lesson', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id')
    .notNull()
    .references(() => subject.id),
  cohortIds: jsonb('cohort_ids').$type<string[]>(),
  teacherIds: jsonb('teacher_ids').$type<string[]>(),
  groupsIds: jsonb('group_ids').$type<string[]>(),
  classroomIds: jsonb('classroom_ids').$type<string[]>(),
  periodsPerWeek: integer('periods_per_week').notNull(),
  weeksDefinitionId: text('weeks_definition_id')
    .notNull()
    .references(() => weekDefinition.id),
  termDefinitionId: text('term_definition_id')
    .notNull()
    .references(() => termDefinition.id),
  dayDefinitionId: text('day_definition_id')
    .notNull()
    .references(() => dayDefinition.id),
  // TODO: figure out if we need this
  // capacity: integer('capacity').notNull(),
});
