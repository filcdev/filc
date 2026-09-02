import type {
  ActiveTimetableRow,
  DayRow,
  ExistingLessonRow,
  LessonCohortRow,
  NewClassroom,
  NewCohort,
  NewDay,
  NewLesson,
  NewPeriod,
  NewSubject,
  NewTeacher,
  NewWeekDefinition,
  PeriodRow,
  SubjectRow,
  TeacherRow,
  TimetableImportStore,
} from '@filcdev/timetable-import/store';
import { and, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '#database';
import {
  building,
  classroom as classroomTable,
  cohort as cohortTable,
  cohortTimetableMtm,
  dayDefinition,
  lessonCohortMTM,
  lesson as lessonTable,
  period as periodTable,
  subject as subjectTable,
  teacher as teacherTable,
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

  async findCohortByName(tx, name): Promise<string | null> {
    const [existing] = await tx
      .select({ id: cohortTable.id })
      .from(cohortTable)
      .where(eq(cohortTable.name, name))
      .limit(1);
    return existing?.id ?? null;
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
        id: lessonTable.id,
        periodId: lessonTable.periodId,
        subjectId: lessonTable.subjectId,
        teacherIds: lessonTable.teacherIds,
        weeksDefinitionId: lessonTable.weeksDefinitionId,
      })
      .from(lessonTable)
      .where(eq(lessonTable.timetableId, timetableId));

    return rows.map((row) => ({
      ...row,
      classroomIds: (row.classroomIds ?? []) as string[],
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
        firstName: teacherTable.firstName,
        id: teacherTable.id,
        lastName: teacherTable.lastName,
      })
      .from(teacherTable)
      .where(inArray(teacherTable.lastName, lastNames));
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
      firstName: teacherTable.firstName,
      id: teacherTable.id,
      lastName: teacherTable.lastName,
    });
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
  async transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return await db.transaction(fn);
  },
};
