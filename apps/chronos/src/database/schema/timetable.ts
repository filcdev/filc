import {
  bit,
  boolean,
  date,
  integer,
  type PgColumn,
  pgTable,
  primaryKey,
  text,
  time,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from '#database/helpers';
import { user } from '#database/schema/authentication';

export const timetable = pgTable('timetable', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  validFrom: date('valid_from'),
  ...timestamps,
});

export const period = pgTable('period', {
  endTime: time('end_time').notNull(),
  id: text('id').primaryKey(),
  period: integer('period').notNull(),
  startTime: time('start_time').notNull(),
  ...timestamps,
});

export const dayDefinition = pgTable('day_definition', {
  days: text('days').array(),
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  ...timestamps,
});

// TODO: rewiew whether this column is necessary
export const weekDefinition = pgTable('week_definition', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  weeks: text('weeks').array(),
  ...timestamps,
});

export const termDefinition = pgTable('term_definition', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  terms: text('terms').array(),
  ...timestamps,
});

export const subject = pgTable('subject', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  ...timestamps,
});

export const teacher = pgTable('teacher', {
  firstName: text('first_name').notNull(),
  gender: bit({ dimensions: 1 }),
  id: text('id').primaryKey(),
  lastName: text('last_name').notNull(),
  short: text('short').notNull(),
  userId: uuid('user_id').references((): PgColumn => user.id),
});

export const building = pgTable('building', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const classroom = pgTable('classroom', {
  buildingId: text('building_id')
    .notNull()
    .references(() => building.id),
  capacity: integer('capacity'),
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
});

export const cohort = pgTable('cohort', {
  // TODO: review if we need to store multiple classrooms
  classroomIds: text('classroom_ids').array(),
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  short: text('short').notNull(),
  teacherId: text('teacher_id').references(() => teacher.id),
  timetableId: text('timetable_id')
    .references(() => timetable.id, {
      onDelete: 'cascade',
    })
    .notNull(),
  // TODO: review if school uses this
  // grade: integer('grade').notNull();
});

export const cohortGroup = pgTable('group', {
  cohortId: text('cohort_id')
    .notNull()
    .references(() => cohort.id),
  entireClass: boolean('entire_class').notNull(),
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // TODO: figure out what this does
  // divisionTag: integer('division_tag'),
  // TODO: review if school uses this
  studentCount: integer('student_count').notNull(),
  teacherId: text('teacher_id').references(() => teacher.id),
  timetableId: text('timetable_id')
    .references(() => timetable.id, {
      onDelete: 'cascade',
    })
    .notNull(),
});

export const lesson = pgTable('lesson', {
  classroomIds: text('classroom_ids').array(),
  dayDefinitionId: text('day_definition_id')
    .notNull()
    .references(() => dayDefinition.id),
  groupsIds: text('group_ids').array(),
  id: text('id').primaryKey(),
  periodId: text('period_id')
    .notNull()
    .references(() => period.id),
  periodsPerWeek: integer('periods_per_week').notNull(),
  subjectId: text('subject_id')
    .notNull()
    .references(() => subject.id),
  teacherIds: text('teacher_ids').array(),
  termDefinitionId: text('term_definition_id')
    // .notNull()
    .references(() => termDefinition.id),
  timetableId: text('timetable_id')
    .references(() => timetable.id, {
      onDelete: 'cascade',
    })
    .notNull(),
  weeksDefinitionId: text('weeks_definition_id')
    .notNull()
    .references(() => weekDefinition.id),
  // TODO: figure out if we need this
  // TLDR: We don't need this.
  // capacity: integer('capacity').notNull(),
});

export const lessonCohortMTM = pgTable(
  'lesson_cohort_mtm',
  {
    cohortId: text('cohort_id')
      .references(() => cohort.id, { onDelete: 'cascade' })
      .notNull(),
    lessonId: text('lesson_id')
      .references(() => lesson.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.cohortId] })]
);

export const substitution = pgTable('substitution', {
  date: date('date').notNull(),
  id: text('id').primaryKey(),
  substituterId: text('substituter').references(() => teacher.id), // If null, then cancelled.
});

export const substitutionLessonMTM = pgTable(
  'substitution_lesson_mtm',
  {
    lessonId: text('lesson_id')
      .references(() => lesson.id, { onDelete: 'cascade' })
      .notNull(),
    substitutionId: text('substitution_id')
      .references(() => substitution.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.substitutionId] })]
);

export const movedLesson = pgTable('moved_lesson', {
  date: date('date').notNull(),
  id: text('id').primaryKey(),
  room: text('room').references(() => classroom.id),
  startingDayId: text('starting_day').references(() => dayDefinition.id),
  startingPeriodId: text('starting_period').references(() => period.id),
});

export const movedLessonLessonMTM = pgTable(
  'moved_lesson_lesson_mtm',
  {
    lessonId: text('lesson_id')
      .references(() => lesson.id, { onDelete: 'cascade' })
      .notNull(),
    movedLessonId: text('moved_lesson_id')
      .references(() => movedLesson.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.movedLessonId] })]
);

export const timetableSchema = {
  building,
  classroom,
  cohort,
  cohortGroup,
  dayDefinition,
  lesson,
  lessonCohortMTM,
  movedLesson,
  movedLessonLessonMTM,
  period,
  subject,
  substitution,
  substitutionLessonMTM,
  teacher,
  termDefinition,
  timetable,
  weekDefinition,
};
