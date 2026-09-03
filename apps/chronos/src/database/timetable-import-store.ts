import type {
  ActiveTimetableRow,
  ClassroomRow,
  CohortGroupRow,
  DayRow,
  ExistingLessonRow,
  LessonCohortRow,
  NewClassroom,
  NewCohort,
  NewCohortGroup,
  NewDay,
  NewLesson,
  NewPeriod,
  NewSubject,
  NewTeacher,
  NewTerm,
  NewWeekDefinition,
  PeriodRow,
  SubjectRow,
  TeacherRow,
  TimetableImportStore,
} from '@filcdev/timetable-import/store';
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import {
  building,
  classroom as classroomTable,
  cohortGroup as cohortGroupTable,
  cohort as cohortTable,
  cohortTimetableMtm,
  dayDefinition,
  lessonCohortMTM,
  lesson as lessonTable,
  period as periodTable,
  subject as subjectTable,
  teacher as teacherTable,
  termDefinition,
  timetable as timetableTable,
  weekDefinition as weekTable,
} from '#database/schema/timetable';

type Database = typeof db;
export type TxClient = Parameters<Parameters<Database['transaction']>[0]>[0];

export const timetableImportStore: TimetableImportStore<TxClient> = {
  async expireTimetable(tx, id, validTo) {
    await tx
      .update(timetableTable)
      .set({ validTo })
      .where(eq(timetableTable.id, id));
  },

  async findActiveTimetable(tx, today): Promise<ActiveTimetableRow | null> {
    const [active] = await tx
      .select({ id: timetableTable.id, validTo: timetableTable.validTo })
      .from(timetableTable)
      .where(
        and(
          lte(timetableTable.validFrom, today),
          or(isNull(timetableTable.validTo), gte(timetableTable.validTo, today))
        )
      )
      .orderBy(desc(timetableTable.validFrom))
      .limit(1)
      .for('update');
    return active ?? null;
  },

  async findBuildingByName(tx, name): Promise<string | null> {
    const [existing] = await tx
      .select({ id: building.id })
      .from(building)
      .where(eq(building.name, name))
      .limit(1);
    return existing?.id ?? null;
  },

  async findClassroomByName(tx, name): Promise<string | null> {
    const [existing] = await tx
      .select({ id: classroomTable.id })
      .from(classroomTable)
      .where(eq(classroomTable.name, name))
      .limit(1);
    return existing?.id ?? null;
  },

  async findClassroomsByName(tx, names): Promise<ClassroomRow[]> {
    if (!names.length) {
      return [];
    }
    return await tx
      .select({ id: classroomTable.id, name: classroomTable.name })
      .from(classroomTable)
      .where(inArray(classroomTable.name, names));
  },

  async findCohortByName(tx, name, year): Promise<string | null> {
    // Scope cohort identity to the calendar year a linked timetable starts in,
    // so a rename in a new school year creates a fresh cohort instead of
    // reusing (and conflating with) the last year's one.
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;
    const [existing] = await tx
      .select({ id: cohortTable.id })
      .from(cohortTable)
      .innerJoin(
        cohortTimetableMtm,
        eq(cohortTimetableMtm.cohortId, cohortTable.id)
      )
      .innerJoin(
        timetableTable,
        eq(timetableTable.id, cohortTimetableMtm.timetableId)
      )
      .where(
        and(
          eq(cohortTable.name, name),
          gte(timetableTable.validFrom, yearStart),
          lt(timetableTable.validFrom, yearEnd)
        )
      )
      .limit(1);
    return existing?.id ?? null;
  },

  async findCohortGroupByCohortAndName(
    tx,
    cohortId,
    name
  ): Promise<string | null> {
    const [existing] = await tx
      .select({ id: cohortGroupTable.id })
      .from(cohortGroupTable)
      .where(
        and(
          eq(cohortGroupTable.cohortId, cohortId),
          eq(cohortGroupTable.name, name)
        )
      )
      .limit(1);
    return existing?.id ?? null;
  },

  async findCohortGroupsByCohorts(tx, cohortIds): Promise<CohortGroupRow[]> {
    if (!cohortIds.length) {
      return [];
    }
    return await tx
      .select({
        cohortId: cohortGroupTable.cohortId,
        id: cohortGroupTable.id,
        name: cohortGroupTable.name,
      })
      .from(cohortGroupTable)
      .where(inArray(cohortGroupTable.cohortId, cohortIds));
  },

  async findDaysByName(tx, names): Promise<DayRow[]> {
    if (!names.length) {
      return [];
    }
    return await tx
      .select({ id: dayDefinition.id, name: dayDefinition.name })
      .from(dayDefinition)
      .where(inArray(dayDefinition.name, names));
  },

  async findLessonCohorts(tx, lessonIds): Promise<LessonCohortRow[]> {
    if (!lessonIds.length) {
      return [];
    }
    return await tx
      .select({
        cohortId: lessonCohortMTM.cohortId,
        lessonId: lessonCohortMTM.lessonId,
      })
      .from(lessonCohortMTM)
      .where(inArray(lessonCohortMTM.lessonId, lessonIds));
  },

  async findLessonsByTimetable(tx, timetableId): Promise<ExistingLessonRow[]> {
    const rows = await tx
      .select({
        classroomIds: lessonTable.classroomIds,
        dayDefinitionId: lessonTable.dayDefinitionId,
        groupsIds: lessonTable.groupsIds,
        id: lessonTable.id,
        periodId: lessonTable.periodId,
        subjectId: lessonTable.subjectId,
        teacherIds: lessonTable.teacherIds,
        termDefinitionId: lessonTable.termDefinitionId,
        weeksDefinitionId: lessonTable.weeksDefinitionId,
      })
      .from(lessonTable)
      .where(eq(lessonTable.timetableId, timetableId));

    return rows.map((row) => ({
      ...row,
      classroomIds: (row.classroomIds ?? []) as string[],
      groupsIds: (row.groupsIds ?? []) as string[],
      teacherIds: (row.teacherIds ?? []) as string[],
    }));
  },

  async findPeriodsByNumber(tx, periods): Promise<PeriodRow[]> {
    if (!periods.length) {
      return [];
    }
    return await tx
      .select({ id: periodTable.id, period: periodTable.period })
      .from(periodTable)
      .where(inArray(periodTable.period, periods));
  },

  async findSubjectsByName(tx, names): Promise<SubjectRow[]> {
    if (!names.length) {
      return [];
    }
    return await tx
      .select({ id: subjectTable.id, name: subjectTable.name })
      .from(subjectTable)
      .where(inArray(subjectTable.name, names));
  },

  async findTeachersByLastName(tx, lastNames): Promise<TeacherRow[]> {
    if (!lastNames.length) {
      return [];
    }
    return await tx
      .select({
        email: teacherTable.email,
        firstName: teacherTable.firstName,
        id: teacherTable.id,
        lastName: teacherTable.lastName,
      })
      .from(teacherTable)
      .where(inArray(teacherTable.lastName, lastNames));
  },

  async findTermByName(tx, name): Promise<string | null> {
    const [existing] = await tx
      .select({ id: termDefinition.id })
      .from(termDefinition)
      .where(eq(termDefinition.name, name))
      .limit(1);
    return existing?.id ?? null;
  },

  async findUserIdsByEmail(tx, emails) {
    if (!emails.length) {
      return [];
    }
    return await tx
      .select({ email: userTable.email, id: userTable.id })
      .from(userTable)
      .where(
        inArray(
          sql`lower(${userTable.email})`,
          emails.map((email) => email.toLowerCase())
        )
      );
  },

  async findWeekDefinitionByName(tx, name): Promise<string | null> {
    const [existing] = await tx
      .select({ id: weekTable.id })
      .from(weekTable)
      .where(eq(weekTable.name, name))
      .limit(1);
    return existing?.id ?? null;
  },

  async insertBuilding(tx, name): Promise<string> {
    const [inserted] = await tx
      .insert(building)
      .values({ id: crypto.randomUUID(), name })
      .returning({ insertedId: building.id });
    if (!inserted) {
      throw new Error('Failed to insert building');
    }
    return inserted.insertedId;
  },

  async insertClassroom(tx, row: NewClassroom): Promise<string | null> {
    const [inserted] = await tx
      .insert(classroomTable)
      .values(row)
      .returning({ insertedId: classroomTable.id });
    return inserted?.insertedId ?? null;
  },

  async insertCohort(tx, row: NewCohort): Promise<string | null> {
    const [inserted] = await tx
      .insert(cohortTable)
      .values(row)
      .returning({ insertedId: cohortTable.id });
    return inserted?.insertedId ?? null;
  },

  async insertCohortGroup(tx, row: NewCohortGroup): Promise<string | null> {
    const [inserted] = await tx
      .insert(cohortGroupTable)
      .values(row)
      .returning({ insertedId: cohortGroupTable.id });
    return inserted?.insertedId ?? null;
  },

  async insertDays(tx, rows: NewDay[]): Promise<DayRow[]> {
    return await tx
      .insert(dayDefinition)
      .values(rows)
      .returning({ id: dayDefinition.id, name: dayDefinition.name });
  },

  async insertLessonCohorts(tx, rows) {
    if (!rows.length) {
      return;
    }
    await tx.insert(lessonCohortMTM).values(rows);
  },

  async insertLessons(tx, rows: NewLesson[]): Promise<string[]> {
    const inserted = await tx
      .insert(lessonTable)
      .values(rows)
      .returning({ id: lessonTable.id });
    return inserted.map((row) => row.id);
  },

  async insertPeriods(tx, rows: NewPeriod[]): Promise<PeriodRow[]> {
    return await tx
      .insert(periodTable)
      .values(rows)
      .returning({ id: periodTable.id, period: periodTable.period });
  },

  async insertSubjects(tx, rows: NewSubject[]): Promise<SubjectRow[]> {
    return await tx
      .insert(subjectTable)
      .values(rows)
      .returning({ id: subjectTable.id, name: subjectTable.name });
  },

  async insertTeachers(tx, rows: NewTeacher[]): Promise<TeacherRow[]> {
    return await tx.insert(teacherTable).values(rows).returning({
      email: teacherTable.email,
      firstName: teacherTable.firstName,
      id: teacherTable.id,
      lastName: teacherTable.lastName,
    });
  },

  async insertTerm(tx, row: NewTerm): Promise<string> {
    const [inserted] = await tx
      .insert(termDefinition)
      .values(row)
      .returning({ insertedId: termDefinition.id });
    if (!inserted) {
      throw new Error('Failed to insert term definition');
    }
    return inserted.insertedId;
  },

  async insertTimetable(tx, row) {
    const [inserted] = await tx
      .insert(timetableTable)
      .values(row)
      .returning({ id: timetableTable.id });
    if (!inserted) {
      throw new Error('Failed to insert new timetable.');
    }
    return inserted.id;
  },

  async insertWeekDefinition(tx, row: NewWeekDefinition): Promise<string> {
    const [inserted] = await tx
      .insert(weekTable)
      .values(row)
      .returning({ insertedId: weekTable.id });
    if (!inserted) {
      throw new Error('Failed to insert week definition');
    }
    return inserted.insertedId;
  },
  async linkCohortToTimetable(tx, link) {
    await tx.insert(cohortTimetableMtm).values(link).onConflictDoNothing();
  },

  async linkTeacherToUser(tx, teacherId, userId) {
    await tx
      .update(teacherTable)
      .set({ userId })
      .where(and(eq(teacherTable.id, teacherId), isNull(teacherTable.userId)));
  },
  async transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return await db.transaction(fn);
  },

  async updateCohortGroup(
    tx,
    id,
    patch: { divisionTag: string | null }
  ): Promise<void> {
    await tx
      .update(cohortGroupTable)
      .set(patch)
      .where(eq(cohortGroupTable.id, id));
  },

  async updateTeacherEmail(tx, id, email) {
    await tx.update(teacherTable).set({ email }).where(eq(teacherTable.id, id));
  },
};
