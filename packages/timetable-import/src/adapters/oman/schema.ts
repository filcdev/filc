import { z } from 'zod';

export const daySchema = z.object({
  _day: z.string(),
  _name: z.string(),
  _short: z.string(),
});

export const periodSchema = z.object({
  _endtime: z.string(),
  _period: z.string(),
  _starttime: z.string(),
});

export const gradeSchema = z.object({
  _id: z.string(),
  _name: z.string(),
});

export const subjectSchema = z.object({
  _id: z.string(),
  _name: z.string(),
  _short: z.string(),
});

export const teacherSchema = z.object({
  _color: z.string(),
  _gender: z.string(),
  _id: z.string(),
  _name: z.string(),
  _short: z.string(),
});

export const classroomSchema = z.object({
  _capacity: z.string(),
  _id: z.string(),
  _name: z.string(),
  _short: z.string(),
});

export const studentsubjectsSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
});

export const classSchema = z.object({
  _gradeid: z.string(),
  _id: z.string(),
  _name: z.string(),
  _short: z.string(),
  _teacherid: z.string(),
});

export const studentsSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
});

export const cardSchema = z.object({
  _classids: z.string(),
  _classroomid: z.string(),
  _day: z.string(),
  _lessonid: z.string(),
  _period: z.string(),
  _studentids: z.string(),
  _subjectid: z.string(),
  _teacherid: z.string(),
});

export const lessonSchema = z.object({
  _capacity: z.string(),
  _classids: z.string(),
  _id: z.string(),
  _periodsperweek: z.string(),
  _seminargroup: z.string(),
  _studentids: z.string(),
  _subjectid: z.string(),
  _teacherid: z.string(),
});

export const teacherSubjectClassSchema = z.object({
  _ClassID: z.string(),
  _OptionalClassID: z.string(),
  _SubjectGradeID: z.string(),
  _TeacherID: z.string(),
});

export const timeTableScheduleSchema = z.object({
  _ClassID: z.string(),
  _DayID: z.string(),
  _LengthID: z.string().optional(),
  _OptionalClassID: z.string(),
  _Period: z.string(),
  _SchoolRoomID: z.string(),
  _SubjectGradeID: z.string(),
  _TeacherID: z.string(),
});

export const daysSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
  day: z.array(daySchema),
});

export const periodsSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
  period: z.array(periodSchema),
});

export const gradesSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
  grade: z.array(gradeSchema),
});

export const subjectsSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
  subject: z.array(subjectSchema),
});

export const teachersSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
  teacher: z.array(teacherSchema),
});

export const classroomsSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
  classroom: z.array(classroomSchema),
});

export const classesSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
  class: z.array(classSchema),
});

export const cardsSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
  card: z.array(cardSchema),
});

export const lessonsSchema = z.object({
  _columns: z.string(),
  _options: z.string(),
  lesson: z.array(lessonSchema),
});

export const teacherSubjectClassesSchema = z.object({
  TeacherSubjectClass: z.array(teacherSubjectClassSchema),
});

export const timeTableSchedulesSchema = z.object({
  TimeTableSchedule: z.array(timeTableScheduleSchema),
});

export const timetableSchema = z.object({
  _ascttversion: z.string(),
  _displaycountries: z.string(),
  _displayinmenu: z.string(),
  _displayname: z.string(),
  _importtype: z.string(),
  _options: z.string(),
  cards: cardsSchema,
  classes: classesSchema,
  classrooms: classroomsSchema,
  days: daysSchema,
  grades: gradesSchema,
  lessons: lessonsSchema,
  OptionalClasses: z.string(),
  periods: periodsSchema,
  StudentEssentialClasses: z.string(),
  StudentOptionalClasses: z.string(),
  students: studentsSchema,
  studentsubjects: studentsubjectsSchema,
  subjects: subjectsSchema,
  TeacherSubjectClasses: teacherSubjectClassesSchema,
  TimeTableSchedules: timeTableSchedulesSchema,
  teachers: teachersSchema,
});

export const timetableExportRootSchema = z.object({
  timetable: timetableSchema,
});
