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
  /** Teacher email address, when the source export provides one. */
  email?: string | null;
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
  /**
   * The aSc numeric `divisiontag` string, used as the canonical division key.
   * Groups that are alternatives in one split share the same value
   * (`'57'` for both `11.A angol1` and `11.A angol2`). `null` when the group
   * has no split. Used to offer a per-division `"pick your group"` choice and
   * to keep exactly one group per division.
   */
  divisionTag: string | null;
  studentCount: number | null;
  /** Source homeroom teacher id; resolved to a database id by the importer. */
  teacherId: string | null;
};

// Bounded quantifiers keep these linear to avoid CodeQL's polynomial-regex
// check (the unbounded `\s*\d+$` could backtrack per digit from every offset).
const CLASS_CODE_PREFIX_RE = /^\d{1,2}\.[A-Z]{1,2}\s+/;
const TRAILING_NUMBER_RE = /\s{0,8}\d{1,4}$/;
const MULTIPLE_WHITESPACE_RE = /\s+/g;

/**
 * Derive a **readable** division label from a group name, for display. The
 * class-code prefix and the trailing group index are dropped
 * (`'11.A angol1'` → `'angol'`, `'kemia2'` → `'kemia'`, `'13.AB mat3'` →
 * `'mat'`). Returns `null` when the group covers the whole cohort or the name
 * carries no division marker. Note this labels only; grouping must use the
 * numeric {@link GroupInput.divisionTag}.
 */
export const deriveDivisionLabel = (
  name: string,
  entireClass: boolean
): string | null => {
  if (entireClass) {
    return null;
  }
  const label = name
    .replace(CLASS_CODE_PREFIX_RE, '')
    .replace(TRAILING_NUMBER_RE, '')
    .trim();
  if (!label || label === name) {
    return null;
  }
  return label;
};

/**
 * Normalise an entity name for stable matching across imports: trim and
 * collapse internal whitespace so `"  Math  "` and `"Math"` resolve to the same
 * row instead of creating duplicate subjects/teachers/classrooms/cohorts.
 */

export const normalizeName = (value: string): string =>
  value.replace(MULTIPLE_WHITESPACE_RE, ' ').trim();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalise a teacher email for stable linking against `user.email`: strip
 * whitespace, lowercase and reject values that cannot be an address (an
 * unquoted address never contains whitespace, so anything else is junk that
 * can never match an account). Invalid input yields `''`, which callers treat
 * as absent.
 */
export const normalizeEmail = (value: string): string => {
  const email = value.replace(/\s+/g, '').toLowerCase();
  return EMAIL_RE.test(email) ? email : '';
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
  /** Name of the term definition the lesson belongs to (matched by name). */
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
