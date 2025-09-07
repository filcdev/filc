import { and, eq } from 'drizzle-orm';
import { db } from '~/database';
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
} from '~/database/schema/timetable';

export const importTimetableXML = async (xmlDoc: Document) => {
  // We might just want this in lessons for mapping
  // This will work, just not all IDish and such.
  // It would be ideal to fix when we add all that
  // separate timetable ID stuff and such doohickeys.
  const _periodMap = await loadPeriods(xmlDoc);
  const dayMap = await loadDays(xmlDoc);
  const subjectMap = await loadSubjects(xmlDoc);
  const teacherMap = await loadTeachers(xmlDoc);
  const classroomMap = await loadClassrooms(xmlDoc);
  const cohortMap = await loadCohort(xmlDoc, teacherMap);
  const _lessons = await loadLessons(xmlDoc, {
    subjectMap,
    cohortMap,
    teacherMap,
    classroomMap,
    dayMap,
  });
};

const loadPeriods = async (xmlDoc: Document) => {
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
        'Incomplete data for period, unable to get all attributes'
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

const loadDays = async (xmlDoc: Document): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const days = xmlDoc.getElementsByTagName('day');

  for (let i = 0; i < days.length; i++) {
    const day = days.item(i);
    if (!day) {
      return result;
    }

    const predefinedId = day.getAttribute('day');
    const name = day.getAttribute('name');
    const short = day.getAttribute('short');

    if (!(name && predefinedId && short)) {
      throw new Error('Incomplete data for day, unable to get all attributes');
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

const loadSubjects = async (xmlDoc: Document): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const subjects = xmlDoc.getElementsByTagName('subject');

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
        `incomplete data for subject, unable to get all attributes: id=${predefinedId}, name=${name}, short=${short}`
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

const loadTeachers = async (xmlDoc: Document): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const teachers = xmlDoc.getElementsByTagName('teacher');

  for (let i = 0; i < teachers.length; i++) {
    const teacher = teachers.item(i);
    if (!teacher) {
      return result;
    }

    //<teacher id="*1" name="Babusa TamĂˇs Gyula" short="Babusa" gender="F" color="#FF0000"/>
    const predefinedId = teacher.getAttribute('id');
    const name = teacher.getAttribute('name');
    let short = teacher.getAttribute('short');
    const gender = teacher.getAttribute('gender');

    if (!short) {
      short = '-';
    }

    if (!(name && predefinedId && gender)) {
      throw new Error(
        `incomplete data for teacher, unable to get all attributes: id=${predefinedId}, name=${name}, short=${short}, gender=${gender}`
      );
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
          // gender,
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

// --- Classrooms -----------------------------------------------------------------

const getOrCreateBuilding = async (name: string): Promise<string> => {
  const [existing] = await db
    .select()
    .from(buildingSchema)
    .where(eq(buildingSchema.name, name))
    .limit(1);
  if (existing) {
    return existing.id;
  }
  const [inserted] = await db
    .insert(buildingSchema)
    .values({ id: crypto.randomUUID(), name })
    .returning({ insertedId: buildingSchema.id });
  if (!inserted) {
    throw new Error('Failed to insert building');
  }
  return inserted.insertedId;
};

const upsertClassroom = async (
  buildingId: string,
  attrs: { id: string; name: string; short: string; capacityStr: string }
): Promise<[predefinedId: string, dbId: string] | null> => {
  const capacity =
    attrs.capacityStr === '*' ? null : Number.parseInt(attrs.capacityStr, 10);
  const [existing] = await db
    .select()
    .from(classroomSchema)
    .where(eq(classroomSchema.name, attrs.name))
    .limit(1);
  if (existing) {
    return [attrs.id, existing.id];
  }
  const [inserted] = await db
    .insert(classroomSchema)
    .values({
      id: crypto.randomUUID(),
      name: attrs.name,
      short: attrs.short,
      capacity,
      buildingId,
    })
    .returning({ insertedId: classroomSchema.id });
  if (!inserted) {
    return null;
  }
  return [attrs.id, inserted.insertedId];
};

const loadClassrooms = async (
  xmlDoc: Document
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const buildingId = await getOrCreateBuilding('A');
  const classrooms = xmlDoc.getElementsByTagName('classroom');
  for (let i = 0; i < classrooms.length; i++) {
    const el = classrooms.item(i);
    if (!el) {
      continue;
    }
    const predefinedId = el.getAttribute('id');
    const name = el.getAttribute('name');
    const short = el.getAttribute('short');
    const capacityStr = el.getAttribute('capacity');
    if (!(predefinedId && name && short && capacityStr)) {
      throw new Error(
        'Incomplete data for classroom, unable to get all attributes'
      );
    }
    const upserted = await upsertClassroom(buildingId, {
      id: predefinedId,
      name,
      short,
      capacityStr,
    });
    if (upserted) {
      const [pre, dbId] = upserted;
      result.set(pre, dbId);
    }
  }
  return result;
};

// --- Cohorts --------------------------------------------------------------------

type CohortAttributes = {
  predefinedId: string;
  name: string;
  short: string;
  teacherId: string | null;
};

const parseCohortElement = (
  el: Element,
  teacherMap: Map<string, string>
): CohortAttributes | null => {
  const predefinedId = el.getAttribute('id');
  const name = el.getAttribute('name');
  const short = el.getAttribute('short');
  const predefinedTeacherId = el.getAttribute('teacherid');
  if (!(predefinedId && name && short)) {
    return null;
  }
  const teacherId = predefinedTeacherId
    ? (teacherMap.get(predefinedTeacherId) ?? null)
    : null;
  return { predefinedId, name, short, teacherId };
};

const upsertCohort = async (
  attrs: CohortAttributes
): Promise<[string, string] | null> => {
  const [existing] = await db
    .select()
    .from(cohortSchema)
    .where(eq(cohortSchema.name, attrs.name))
    .limit(1);
  if (existing) {
    return [attrs.predefinedId, existing.id];
  }
  if (!attrs.teacherId) {
    return null; // original behaviour only inserts when teacher present
  }
  const [inserted] = await db
    .insert(cohortSchema)
    .values({
      id: crypto.randomUUID(),
      name: attrs.name,
      short: attrs.short,
      teacherId: attrs.teacherId,
    })
    .returning({ insertedId: cohortSchema.id });
  if (!inserted) {
    return null;
  }
  return [attrs.predefinedId, inserted.insertedId];
};

const loadCohort = async (
  xmlDoc: Document,
  teacherMap: Map<string, string>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const cohorts = xmlDoc.getElementsByTagName('class');
  for (let i = 0; i < cohorts.length; i++) {
    const el = cohorts.item(i);
    if (!el) {
      continue;
    }
    const attrs = parseCohortElement(el, teacherMap);
    if (!attrs) {
      continue;
    }
    const upserted = await upsertCohort(attrs);
    if (upserted) {
      const [pre, dbId] = upserted;
      result.set(pre, dbId);
    }
  }
  return result;
};

// --- Lessons --------------------------------------------------------------------

type LessonGroup = {
  subjectId?: string;
  cohortIds: Set<string>;
  teacherIds: Set<string>;
  classroomIds: Set<string>;
  dayDefinitionId?: string;
  periodsCount: number;
};

const ensureWeekDefinition = async (weekName: string): Promise<string> => {
  const [existing] = await db
    .select()
    .from(weekSchema)
    .where(eq(weekSchema.name, weekName))
    .limit(1);
  if (existing) {
    return existing.id;
  }
  const [inserted] = await db
    .insert(weekSchema)
    .values({
      id: crypto.randomUUID(),
      name: weekName,
      short: weekName,
      weeks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ insertedId: weekSchema.id });
  if (!inserted) {
    throw new Error('Failed to insert week definition');
  }
  return inserted.insertedId;
};

const getOrInitLessonGroup = (
  map: Map<string, LessonGroup>,
  key: string,
  init: () => LessonGroup
): LessonGroup => {
  let g = map.get(key);
  if (!g) {
    g = init();
    map.set(key, g);
  }
  return g;
};

const processScheduleElement = (
  el: Element,
  maps: {
    subjectMap: Map<string, string>;
    cohortMap: Map<string, string>;
    teacherMap: Map<string, string>;
    classroomMap: Map<string, string>;
    dayMap: Map<string, string>;
  },
  groups: Map<string, LessonGroup>
) => {
  const dayId = el.getAttribute('DayID');
  const subjectGradeId = el.getAttribute('SubjectGradeID');
  if (!(dayId && subjectGradeId)) {
    return; // skip incomplete rows
  }
  const classId = el.getAttribute('ClassID');
  const optionalClassId = el.getAttribute('OptionalClassID');
  const teacherId = el.getAttribute('TeacherID');
  const schoolRoomId = el.getAttribute('SchoolRoomID');
  const groupKey = `${subjectGradeId}-${dayId}`;
  const group = getOrInitLessonGroup(groups, groupKey, () => ({
    subjectId: maps.subjectMap.get(subjectGradeId),
    cohortIds: new Set(),
    teacherIds: new Set(),
    classroomIds: new Set(),
    dayDefinitionId: maps.dayMap.get(dayId),
    periodsCount: 0,
  }));
  group.periodsCount++;
  if (classId) {
    const id = maps.cohortMap.get(classId);
    if (id) {
      group.cohortIds.add(id);
    }
  }
  if (optionalClassId) {
    const id = maps.cohortMap.get(optionalClassId);
    if (id) {
      group.cohortIds.add(id);
    }
  }
  if (teacherId) {
    const id = maps.teacherMap.get(teacherId);
    if (id) {
      group.teacherIds.add(id);
    }
  }
  if (schoolRoomId) {
    const id = maps.classroomMap.get(schoolRoomId);
    if (id) {
      group.classroomIds.add(id);
    }
  }
};

const buildLessonGroups = (
  xmlDoc: Document,
  maps: {
    subjectMap: Map<string, string>;
    cohortMap: Map<string, string>;
    teacherMap: Map<string, string>;
    classroomMap: Map<string, string>;
    dayMap: Map<string, string>;
  }
): Map<string, LessonGroup> => {
  const schedules = xmlDoc.getElementsByTagName('TimeTableSchedule');
  const groups = new Map<string, LessonGroup>();
  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules.item(i);
    if (!schedule) {
      continue;
    }
    processScheduleElement(schedule, maps, groups);
  }
  return groups;
};

const persistLessonGroups = async (
  groups: Map<string, LessonGroup>,
  weekDefinitionId: string
): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  for (const [key, group] of groups) {
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
    result.set(key, lessonId);
  }
  return result;
};

const loadLessons = async (
  xmlDoc: Document,
  maps: {
    subjectMap: Map<string, string>;
    cohortMap: Map<string, string>;
    teacherMap: Map<string, string>;
    classroomMap: Map<string, string>;
    dayMap: Map<string, string>;
  }
): Promise<Map<string, string>> => {
  const weekDefinitionId = await ensureWeekDefinition('A');
  const groups = buildLessonGroups(xmlDoc, maps);
  return persistLessonGroups(groups, weekDefinitionId);
};
