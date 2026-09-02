/**
 * The persistence boundary for {@link importTimetable}.
 *
 * Chronos implements this interface against Drizzle; a future app can supply
 * its own implementation. Each method performs a single, narrow database
 * operation against the provided transaction (`Tx`), leaving all entity
 * resolution, deduplication and orchestration logic in the package.
 */

export type ActiveTimetableRow = {
  id: string;
  validTo: string | null;
};

export type PeriodRow = {
  id: string;
  period: number;
};

export type NewPeriod = {
  id: string;
  period: number;
  startTime: string;
  endTime: string;
};

export type DayRow = {
  id: string;
  name: string;
};

export type NewDay = {
  id: string;
  /** Source day ids stored on the day definition (e.g. Oman `_day`). */
  days: string[];
  name: string;
  short: string;
};

export type SubjectRow = {
  id: string;
  name: string;
};

export type NewSubject = {
  id: string;
  name: string;
  short: string;
};

export type TeacherRow = {
  id: string;
  firstName: string;
  lastName: string;
};

export type NewTeacher = {
  id: string;
  firstName: string;
  lastName: string;
  short: string;
};

export type ClassroomRow = {
  id: string;
  name: string;
};

export type NewClassroom = {
  id: string;
  buildingId: string;
  name: string;
  short: string;
  capacity: number | null;
};

export type CohortRow = {
  id: string;
};

export type NewCohort = {
  id: string;
  name: string;
  short: string;
  teacherId: string | null;
  timetableId: string;
};

export type NewWeekDefinition = {
  id: string;
  name: string;
  short: string;
  weeks: string[];
};

export type NewCohortGroup = {
  id: string;
  cohortId: string;
  divisionTag: string | null;
  entireClass: boolean;
  name: string;
  studentCount: number;
  teacherId: string | null;
  timetableId: string;
};

export type NewTerm = {
  id: string;
  name: string;
  short: string;
  terms: string[];
};

export type ExistingLessonRow = {
  id: string;
  subjectId: string;
  dayDefinitionId: string;
  periodId: string;
  weeksDefinitionId: string;
  teacherIds: string[];
  classroomIds: string[];
  groupsIds: string[];
  termDefinitionId: string | null;
};
export type NewLesson = {
  id: string;
  subjectId: string;
  dayDefinitionId: string;
  periodId: string;
  weeksDefinitionId: string;
  teacherIds: string[];
  classroomIds: string[];
  groupsIds: string[];
  periodsPerWeek: number;
  termDefinitionId: string | null;
  timetableId: string;
};

export type LessonCohortRow = {
  lessonId: string;
  cohortId: string;
};

export type NewTimetableRow = {
  id: string;
  name: string;
  validFrom: string;
  validTo: string | null;
};

export type TimetableImportStore<Tx = unknown> = {
  /** Opens a transaction; every subsequent method receives its client. */
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;

  findActiveTimetable(
    tx: Tx,
    today: string
  ): Promise<ActiveTimetableRow | null>;
  expireTimetable(tx: Tx, id: string, validTo: string): Promise<void>;
  insertTimetable(tx: Tx, row: NewTimetableRow): Promise<string>;

  findPeriodsByNumber(tx: Tx, periods: number[]): Promise<PeriodRow[]>;
  insertPeriods(tx: Tx, rows: NewPeriod[]): Promise<PeriodRow[]>;

  findDaysByName(tx: Tx, names: string[]): Promise<DayRow[]>;
  insertDays(tx: Tx, rows: NewDay[]): Promise<DayRow[]>;

  findSubjectsByName(tx: Tx, names: string[]): Promise<SubjectRow[]>;
  insertSubjects(tx: Tx, rows: NewSubject[]): Promise<SubjectRow[]>;

  findTeachersByLastName(tx: Tx, lastNames: string[]): Promise<TeacherRow[]>;
  insertTeachers(tx: Tx, rows: NewTeacher[]): Promise<TeacherRow[]>;

  findBuildingByName(tx: Tx, name: string): Promise<string | null>;
  insertBuilding(tx: Tx, name: string): Promise<string>;
  findClassroomByName(tx: Tx, name: string): Promise<string | null>;
  insertClassroom(tx: Tx, row: NewClassroom): Promise<string | null>;

  findCohortByName(tx: Tx, name: string, year: number): Promise<string | null>;
  insertCohort(tx: Tx, row: NewCohort): Promise<string | null>;
  linkCohortToTimetable(
    tx: Tx,
    link: { cohortId: string; timetableId: string }
  ): Promise<void>;

  findWeekDefinitionByName(tx: Tx, name: string): Promise<string | null>;
  insertWeekDefinition(tx: Tx, row: NewWeekDefinition): Promise<string>;

  findTermByName(tx: Tx, name: string): Promise<string | null>;
  insertTerm(tx: Tx, row: NewTerm): Promise<string>;

  findCohortGroupByCohortAndName(
    tx: Tx,
    cohortId: string,
    name: string
  ): Promise<string | null>;
  insertCohortGroup(tx: Tx, row: NewCohortGroup): Promise<string | null>;
  updateCohortGroup(
    tx: Tx,
    id: string,
    patch: { divisionTag: string | null }
  ): Promise<void>;

  findLessonsByTimetable(
    tx: Tx,
    timetableId: string
  ): Promise<ExistingLessonRow[]>;
  findLessonCohorts(tx: Tx, lessonIds: string[]): Promise<LessonCohortRow[]>;
  /** Inserts rows and returns the ids of the inserted lessons (input order). */
  insertLessons(tx: Tx, rows: NewLesson[]): Promise<string[]>;
  insertLessonCohorts(tx: Tx, rows: LessonCohortRow[]): Promise<void>;
};
