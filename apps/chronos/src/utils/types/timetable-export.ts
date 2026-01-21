import type z from 'zod';
import type { timetableSchema } from '#database/schema/timetable';
import type {
  cardSchema,
  cardsSchema,
  classesSchema,
  classroomSchema,
  classroomsSchema,
  classSchema,
  daySchema,
  daysSchema,
  gradeSchema,
  gradesSchema,
  periodSchema,
  periodsSchema,
  studentsubjectsSchema,
  subjectSchema,
  subjectsSchema,
  teacherSchema,
  teacherSubjectClassesSchema,
  teacherSubjectClassSchema,
  teachersSchema,
  timeTableScheduleSchema,
  timeTableSchedulesSchema,
  timetableExportRootSchema,
} from '#utils/timetable/schemas';

export type TimetableExportRoot = z.infer<typeof timetableExportRootSchema>;
export type Timetable = z.infer<typeof timetableSchema>;
export type Days = z.infer<typeof daysSchema>;
export type Day = z.infer<typeof daySchema>;
export type Periods = z.infer<typeof periodsSchema>;
export type Period = z.infer<typeof periodSchema>;
export type Grades = z.infer<typeof gradesSchema>;
export type Grade = z.infer<typeof gradeSchema>;
export type Subjects = z.infer<typeof subjectsSchema>;
export type Subject = z.infer<typeof subjectSchema>;
export type Teachers = z.infer<typeof teachersSchema>;
export type Teacher = z.infer<typeof teacherSchema>;
export type Classrooms = z.infer<typeof classroomsSchema>;
export type Classroom = z.infer<typeof classroomSchema>;
export type Studentsubjects = z.infer<typeof studentsubjectsSchema>;
export type Classes = z.infer<typeof classesSchema>;
export type Class = z.infer<typeof classSchema>;
export type Students = z.infer<typeof studentsubjectsSchema>;
export type Cards = z.infer<typeof cardsSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Lessons = z.infer<typeof studentsubjectsSchema>;
export type Lesson = z.infer<typeof studentsubjectsSchema>;
export type TeacherSubjectClasses = z.infer<typeof teacherSubjectClassesSchema>;
export type TeacherSubjectClass = z.infer<typeof teacherSubjectClassSchema>;
export type TimeTableSchedules = z.infer<typeof timeTableSchedulesSchema>;
export type TimeTableSchedule = z.infer<typeof timeTableScheduleSchema>;
