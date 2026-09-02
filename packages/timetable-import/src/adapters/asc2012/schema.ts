import { z } from 'zod';

// Attributes are parsed with `attributeNamePrefix: '_'` (see the Oman adapter),
// so every key below is prefixed. aSc exports drop attributes that hold no
// value, so string attrs fall back to `''` instead of failing validation.
const str = () => z.string().catch('');

const ascPeriodSchema = z.object({
  _endtime: str(),
  _name: str(),
  _period: str(),
  _short: str(),
  _starttime: str(),
});

const ascDaysdefSchema = z.object({
  _days: str(),
  _id: str(),
  _name: str(),
  _short: str(),
});

const ascWeeksdefSchema = z.object({
  _id: str(),
  _name: str(),
  _short: str(),
  _weeks: str(),
});

const ascTermsdefSchema = z.object({
  _id: str(),
  _name: str(),
  _short: str(),
  _terms: str(),
});

const ascSubjectSchema = z.object({
  _id: str(),
  _name: str(),
  _short: str(),
});

const ascTeacherSchema = z.object({
  _firstname: str(),
  _id: str(),
  _lastname: str(),
  _short: str(),
});

const ascClassroomSchema = z.object({
  _capacity: str(),
  _id: str(),
  _name: str(),
  _short: str(),
});

const ascClassSchema = z.object({
  _id: str(),
  _name: str(),
  _short: str(),
  _teacherid: str(),
});

const ascGroupSchema = z.object({
  _classid: str(),
  _divisiontag: str(),
  _entireclass: str(),
  _id: str(),
  _name: str(),
  _studentcount: str(),
});

const ascLessonSchema = z.object({
  _classids: str(),
  _classroomids: str(),
  _daysdefid: str(),
  _groupids: str(),
  _id: str(),
  _periodsperweek: str(),
  _subjectid: str(),
  _teacherids: str(),
  _termsdefid: str(),
  _weeksdefid: str(),
});

const ascCardSchema = z.object({
  _classroomids: str(),
  _days: str(),
  _lessonid: str(),
  _period: str(),
  _weeks: str(),
});

const maybeArray = <T extends z.ZodType>(schema: T) =>
  z.union([schema, z.undefined(), z.null()]).optional();

// An empty section renders as `null`/`''` in fast-xml-parser, so each array is
// optional and holes are treated as `[]` during normalization.
export const ascTimetableSchema = z.object({
  cards: maybeArray(z.object({ card: z.array(ascCardSchema) })),
  classes: z.object({ class: z.array(ascClassSchema) }),
  classrooms: z.object({ classroom: z.array(ascClassroomSchema) }),
  daysdefs: z.object({ daysdef: z.array(ascDaysdefSchema) }),
  groups: maybeArray(z.object({ group: z.array(ascGroupSchema) })),
  lessons: maybeArray(z.object({ lesson: z.array(ascLessonSchema) })),
  periods: z.object({ period: z.array(ascPeriodSchema) }),
  subjects: z.object({ subject: z.array(ascSubjectSchema) }),
  teachers: z.object({ teacher: z.array(ascTeacherSchema) }),
  termsdefs: z.object({ termsdef: z.array(ascTermsdefSchema) }),
  weeksdefs: z.object({ weeksdef: z.array(ascWeeksdefSchema) }),
});

export const ascExportRootSchema = z.object({
  timetable: ascTimetableSchema,
});
