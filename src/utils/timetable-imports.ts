import fs from 'node:fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import { and, eq } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import {
  building as buildingSchema,
  classroom as classroomSchema,
  cohort as cohortSchema,
  dayDefinition as daySchema,
  lesson as lessonSchema,
  period as periodSchema,
  subject as subjectSchema,
  teacher as teacherSchema,
  weekDefinition as weekSchema,
} from '../database/schema/timetable';

export const importTimetableXML = async (
  path: string,
  _db: BunSQLDatabase<Record<string, never>>
) => {
  try {
    const parser = new DOMParser();
    const xmlString = await fs.readFile(path, 'utf8');

    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    // TODO: Run all the functions.
  } catch (_error) {}
};

const _loadPeriod = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>
) => {
  const result: Map<string, string> = new Map();
  const periods = xmlDoc.getElementsByTagName('period');

  for (let i = 0; i < periods.length; i++) {
    const period = periods.item(i);
    if (!period) {
      return result;
    }

    const predefinedId = period.getAttribute('period');
    const end_time = period.getAttribute('endtime');
    const start_time = period.getAttribute('starttime');

    if (!(predefinedId && start_time && end_time)) {
      throw new Error(
        'Incomplete data for cohort, unable to get all attributes'
      );
    }

    const [existingPeriod] = await db
      .select()
      .from(periodSchema)
      .where(eq(periodSchema.period, Number(predefinedId)))
      .limit(1);

    if (existingPeriod) {
      result.set(String(existingPeriod.period), existingPeriod.id);
    } else {
      const [insertedPeriod] = await db
        .insert(periodSchema)
        .values({
          id: crypto.randomUUID(),
          period: Number(predefinedId),
          startTime: start_time,
          endTime: end_time,
        })
        .returning({ insertedId: periodSchema.id });

      if (insertedPeriod) {
        result.set(predefinedId, insertedPeriod.insertedId);
      }
    }
  }

  return result;
};

const _loadDays = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const days = xmlDoc.getElementsByTagName('day');

  for (let i = 0; i < days.length; i++) {
    const day = days.item(i);
    if (!day) {
      return result;
    }

    const predefinedId = day.getAttribute('id');
    const name = day.getAttribute('name');
    const short = day.getAttribute('short');

    if (!(name && predefinedId && short)) {
      throw new Error(
        'Incomplete data for cohort, unable to get all attributes'
      );
    }

    const [existingDay] = await db
      .select()
      .from(cohortSchema)
      .where(eq(cohortSchema.name, name))
      .limit(1);

    if (existingDay) {
      result.set(predefinedId, existingDay.id);
    } else {
      const [insertedDay] = await db
        .insert(daySchema)
        .values({
          id: crypto.randomUUID(),
          name,
          short,
        })
        .returning({ insertedId: daySchema.id });

      if (insertedDay) {
        result.set(predefinedId, insertedDay.insertedId);
      }
    }
  }

  return result;
};

const _loadSubjects = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const subjects = xmlDoc.getElementsByTagName('subjects');

  for (let i = 0; i < subjects.length; i++) {
    const subject = subjects.item(i);
    if (!subject) {
      throw new Error(`Failed to get subject at index: ${i}`);
    }

    const predefinedId = subject.getAttribute('id');
    const name = subject.getAttribute('name');
    const short = subject.getAttribute('short');

    if (!(name && predefinedId && short)) {
      throw new Error(
        'Incomplete data for subject, unable to get all attributes'
      );
    }

    const [existingSubject] = await db
      .select()
      .from(subjectSchema)
      .where(eq(subjectSchema.name, name))
      .limit(1);

    if (existingSubject) {
      result.set(predefinedId, existingSubject.id);
    } else {
      const [insertedSubject] = await db
        .insert(subjectSchema)
        .values({
          id: crypto.randomUUID(),
          name,
          short,
        })
        .returning({ insertedId: subjectSchema.id });

      if (insertedSubject) {
        result.set(predefinedId, insertedSubject.insertedId);
      }
    }
  }

  return result;
};

const _loadTeachers = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const teachers = xmlDoc.getElementsByTagName('teacher');

  for (let i = 0; i < teachers.length; i++) {
    const teacher = teachers.item(i);
    if (!teacher) {
      return result;
    }

    const predefinedId = teacher.getAttribute('id');
    const name = teacher.getAttribute('name');
    const short = teacher.getAttribute('short');
    const gender = teacher.getAttribute('gender');
    const color = teacher.getAttribute('color');

    if (!(name && predefinedId && short && gender && color)) {
      continue;
    }

    const names = splitName(name);
    const [existingTeacher] = await db
      .select()
      .from(teacherSchema)
      .where(
        and(
          eq(teacherSchema.firstName, names.firstName),
          eq(teacherSchema.lastName, names.restOfName)
        )
      )
      .limit(1);

    if (existingTeacher) {
      result.set(predefinedId, existingTeacher.id);
    } else {
      const [insertedTeacher] = await db
        .insert(teacherSchema)
        .values({
          id: crypto.randomUUID(),
          firstName: names.firstName,
          lastName: names.restOfName,
          short,
          gender,
        })
        .returning({ insertedId: teacherSchema.id });

      if (insertedTeacher) {
        result.set(predefinedId, insertedTeacher.insertedId);
      }
    }
  }

  return result;
};

const splitName = (
  fullName: string
): { firstName: string; restOfName: string } => {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: '', restOfName: '' };
  }

  const trimmedName = fullName.trim();
  const firstSpaceIndex = trimmedName.indexOf(' ');

  if (firstSpaceIndex === -1) {
    return { firstName: trimmedName, restOfName: '' };
  }

  const firstName = trimmedName.substring(0, firstSpaceIndex);
  const restOfName = trimmedName.substring(firstSpaceIndex + 1).trim();

  return { firstName, restOfName };
};

const _loadClassrooms = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();

  const buildingName = 'A';
  const [existingBuilding] = await db
    .select()
    .from(buildingSchema)
    .where(eq(buildingSchema.name, buildingName))
    .limit(1);

  let buildingId: string;
  if (existingBuilding) {
    buildingId = existingBuilding.id;
  } else {
    const [insertedBuilding] = await db
      .insert(buildingSchema)
      .values({
        id: crypto.randomUUID(),
        name: buildingName,
      })
      .returning({ insertedId: buildingSchema.id });
    buildingId = insertedBuilding.insertedId;
  }

  const classrooms = xmlDoc.getElementsByTagName('classroom');
  for (let i = 0; i < classrooms.length; i++) {
    const classroom = classrooms.item(i);
    if (!classroom) {
      return result;
    }
    const predefinedId = classroom.getAttribute('id');
    const name = classroom.getAttribute('name');
    const short = classroom.getAttribute('short');
    const capacityStr = classroom.getAttribute('capacity');
    if (!(name && predefinedId && short && capacityStr)) {
      throw new Error(
        'Incomplete data for classroom, unable to get all attributes'
      );
    }

    const capacity =
      capacityStr === '*' ? null : Number.parseInt(capacityStr, 10);

    const [existingClassroom] = await db
      .select()
      .from(classroomSchema)
      .where(eq(classroomSchema.name, name))
      .limit(1);
    if (existingClassroom) {
      result.set(predefinedId, existingClassroom.id);
    } else {
      const [insertedClassroom] = await db
        .insert(classroomSchema)
        .values({
          id: crypto.randomUUID(),
          name,
          short,
          capacity,
          buildingId,
        })
        .returning({ insertedId: classroomSchema.id });
      if (insertedClassroom) {
        result.set(predefinedId, insertedClassroom.insertedId);
      }
    }
  }
  return result;
};

const _loadCohort = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>,
  teacherMap: Map<string, string>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const cohorts = xmlDoc.getElementsByTagName('class');

  for (let i = 0; i < cohorts.length; i++) {
    const cohort = cohorts.item(i);
    if (!cohort) {
      return result;
    }

    const predefinedId = cohort.getAttribute('id');
    const name = cohort.getAttribute('name');
    const short = cohort.getAttribute('short');
    const predefinedTeacherId = cohort.getAttribute('teacherid');

    if (!(name && predefinedId && short && predefinedTeacherId)) {
      throw new Error(
        'Incomplete data for cohort, unable to get all attributes'
      );
    }

    const teacherId = teacherMap.get(predefinedTeacherId);

    const [existingCohort] = await db
      .select()
      .from(cohortSchema)
      .where(eq(cohortSchema.name, name))
      .limit(1);

    if (existingCohort) {
      result.set(predefinedId, existingCohort.id);
    } else if (teacherId) {
      const [insertedCohort] = await db
        .insert(cohortSchema)
        .values({
          id: crypto.randomUUID(),
          name,
          short,
          teacherId,
        })
        .returning({ insertedId: cohortSchema.id });

      if (insertedCohort) {
        result.set(predefinedId, insertedCohort.insertedId);
      }
    }
  }

  return result;
};

const _loadLessons = async (
  xmlDoc: Document,
  db: BunSQLDatabase<Record<string, never>>,
  subjectMap: Map<string, string>,
  cohortMap: Map<string, string>,
  teacherMap: Map<string, string>,
  classroomMap: Map<string, string>,
  dayDefinitionMap: Map<string, string>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();

  const weekName = 'A';
  const [existingWeek] = await db
    .select()
    .from(weekSchema)
    .where(eq(weekSchema.name, weekName))
    .limit(1);

  let weekDefinitionId: string;
  if (existingWeek) {
    weekDefinitionId = existingWeek.id;
  } else {
    const [insertedWeek] = await db
      .insert(weekSchema)
      .values({
        id: crypto.randomUUID(),
        name: weekName,
        short: 'A',
        weeks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ insertedId: weekSchema.id });
    weekDefinitionId = insertedWeek.insertedId;
  }

  const schedules = xmlDoc.getElementsByTagName('TimeTableSchedule');
  const lessonGroups = new Map<
    string,
    {
      subjectId?: string;
      cohortIds: Set<string>;
      teacherIds: Set<string>;
      classroomIds: Set<string>;
      dayDefinitionId?: string;
      periodsCount: number;
    }
  >();

  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules.item(i);
    if (!schedule) {
      continue;
    }

    const dayId = schedule.getAttribute('DayID');
    const subjectGradeId = schedule.getAttribute('SubjectGradeID');
    const classId = schedule.getAttribute('ClassID');
    const optionalClassId = schedule.getAttribute('OptionalClassID');
    const teacherId = schedule.getAttribute('TeacherID');
    const schoolRoomId = schedule.getAttribute('SchoolRoomID');

    if (!(dayId && subjectGradeId)) {
      continue;
    }

    const groupKey = `${subjectGradeId}-${dayId}`;

    if (!lessonGroups.has(groupKey)) {
      lessonGroups.set(groupKey, {
        subjectId: subjectMap.get(subjectGradeId),
        cohortIds: new Set(),
        teacherIds: new Set(),
        classroomIds: new Set(),
        dayDefinitionId: dayDefinitionMap.get(dayId),
        periodsCount: 0,
      });
    }

    const group = lessonGroups.get(groupKey);
    if (!group) {
      throw new Error('Group was null :[');
    }

    group.periodsCount++;

    if (classId) {
      const cohortId = cohortMap.get(classId);
      if (cohortId) {
        group.cohortIds.add(cohortId);
      }
    }

    if (optionalClassId) {
      const cohortId = cohortMap.get(optionalClassId);
      if (cohortId) {
        group.cohortIds.add(cohortId);
      }
    }

    if (teacherId) {
      const dbTeacherId = teacherMap.get(teacherId);
      if (dbTeacherId) {
        group.teacherIds.add(dbTeacherId);
      }
    }

    if (schoolRoomId) {
      const classroomId = classroomMap.get(schoolRoomId);
      if (classroomId) {
        group.classroomIds.add(classroomId);
      }
    }
  }

  for (const [groupKey, group] of lessonGroups) {
    if (!(group.subjectId && group.dayDefinitionId)) {
      continue;
    }

    const lessonId = crypto.randomUUID();

    await db.insert(lessonSchema).values({
      id: lessonId,
      subjectId: group.subjectId,
      cohortIds: Array.from(group.cohortIds),
      teacherIds: Array.from(group.teacherIds),
      groupsIds: [],
      classroomIds: Array.from(group.classroomIds),
      periodsPerWeek: group.periodsCount,
      weeksDefinitionId: weekDefinitionId,
      dayDefinitionId: group.dayDefinitionId,
    });

    result.set(groupKey, lessonId);
  }

  return result;
};
