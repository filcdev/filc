/**
 * The format-agnostic timetable import model.
 *
 * Every {@link TimetableImportAdapter} normalises an external file (XLSX,
 * CSV, JSON, another vendor XML, ...) into this shape. The
 * {@link importTimetable} importer knows nothing about the source format: it
 * only persists this model through a {@link TimetableImportStore}.
 *
 * All `id` fields are the *source* identifiers (e.g. the Oman `_period`
 * attribute). The importer resolves them to database ids via the store.
 */

export type PeriodInput = {
  /** Source identifier, e.g. the Oman `_period` attribute. */
  id: string;
  period: number;
  startTime: string;
  endTime: string;
};

export type DayInput = {
  id: string;
  name: string;
  short: string;
};

export type SubjectInput = {
  id: string;
  name: string;
  short: string;
};

export type TeacherInput = {
  id: string;
  firstName: string;
  lastName: string;
  short: string;
};

export type ClassroomInput = {
  id: string;
  name: string;
  short: string;
  /** Numeric capacity, or `null` when the source uses `*`. */
  capacity: number | null;
};

export type CohortInput = {
  id: string;
  name: string;
  short: string;
  /** Source teacher id; resolved to a database id by the importer. */
  teacherId: string | null;
};

/** A group within a cohort (e.g. a language/PE split of a class). */
export type GroupInput = {
  id: string;
  /** Reference to {@link CohortInput.id}. */
  cohortId: string;
  name: string;
  /** `true` when the group covers the entire cohort. */
  entireClass: boolean;
  /** Source `divisiontag`; used to group split lessons together. */
  divisionTag: number | null;
  studentCount: number | null;
  /** Source homeroom teacher id; resolved to a database id by the importer. */
  teacherId: string | null;
};

/** A week definition (e.g. `Hét A`, `Minden héten`). */
export type WeekInput = {
  id: string;
  name: string;
  short: string;
  /** Week pattern from the source, e.g. `['10']`, `['10', '01']`. */
  weeks: string[];
};

/** A term definition (e.g. `Egész év`). */
export type TermInput = {
  id: string;
  name: string;
  short: string;
  /** Term pattern from the source, e.g. `['1']`. */
  terms: string[];
};

export type LessonInput = {
  /**
   * Client-side correlation key for this schedule entry (used to correlate
   * imported schedules). Not persisted.
   */
  id: string;
  /** Reference to {@link DayInput.id}. */
  dayId: string;
  /** Reference to {@link PeriodInput.id}. */
  periodId: string;
  /** Reference to {@link SubjectInput.id}. */
  subjectId: string;
  /** Name of the week definition the lesson belongs to (e.g. `A`). */
  weekId: string;
  /** Reference to {@link TermInput.id} (source term id). */
  termId: string | null;
  /** References to {@link CohortInput.id} (class + optional class). */
  cohortIds: string[];
  /** References to {@link GroupInput.id}. */
  groupIds: string[];
  /** References to {@link TeacherInput.id}. */
  teacherIds: string[];
  /** References to {@link ClassroomInput.id}. */
  classroomIds: string[];
  /** Count of periods per week; defaults to `1` when omitted. */
  periodsPerWeek?: number;
};

export type TimetableImportModel = {
  periods: PeriodInput[];
  days: DayInput[];
  subjects: SubjectInput[];
  teachers: TeacherInput[];
  classrooms: ClassroomInput[];
  cohorts: CohortInput[];
  groups: GroupInput[];
  weeks: WeekInput[];
  terms: TermInput[];
  lessons: LessonInput[];
};

export type TimetableImportOptions = {
  name: string;
  validFrom: string;
  validTo?: string | null;
  /**
   * Building that imported classrooms are attached to. Defaults to `'A'`,
   * matching the historical import behaviour.
   */
  buildingName?: string;
};

/**
 * Minimal logger compatible with `@logtape`'s `Logger`. The importer logs
 * diagnostics through this, so the package stays independent of any logging
 * library.
 */
export type TimetableImportLogger = {
  trace(message: string, properties?: Record<string, unknown>): void;
  debug(message: string, properties?: Record<string, unknown>): void;
  info(message: string, properties?: Record<string, unknown>): void;
  error(message: string, properties?: Record<string, unknown>): void;
};
