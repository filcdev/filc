import { getLogger } from '@logtape/logtape';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import {
  building as buildingSchema,
  classroom as classroomSchema,
  cohort as cohortSchema,
  dayDefinition as daySchema,
  lessonCohortMTM,
  lesson as lessonSchema,
  period as periodSchema,
  subject as subjectSchema,
  teacher as teacherSchema,
  timetable,
  weekDefinition as weekSchema,
} from '#database/schema/timetable';

const logger = getLogger(['chronos', 'timetable']);

type Database = typeof db;
export type TxClient = Parameters<Parameters<Database['transaction']>[0]>[0];

// Drizzle inferred row type helpers
type LessonRow = typeof lessonSchema.$inferSelect;
type LessonRowDraft = Omit<
  LessonRow,
  'teacherIds' | 'classroomIds' | 'groupsIds'
> & {
  teacherIds: string[];
  classroomIds: string[];
  groupsIds: string[];
};

type LessonMaps = {
  subjectMap: Map<string, string>;
  cohortMap: Map<string, string>;
  teacherMap: Map<string, string>;
  classroomMap: Map<string, string>;
  dayMap: Map<string, string>;
  periodMap: Map<string, string>;
};

type CohortAttributes = {
  predefinedId: string;
  name: string;
  short: string;
  teacherId: string | null;
};

export const importTimetableXML = (
  xmlDoc: Document,
  timetableForm: { name: string; validFrom: string }
) =>
  db.transaction(async (tx) => {
    const startedAt = Date.now();
    logger.info('Starting timetable import', {
      timetableName: timetableForm.name,
      validFrom: timetableForm.validFrom,
    });

    const [newTimetable] = await tx
      .insert(timetable)
      .values({
        id: crypto.randomUUID(),
        ...timetableForm,
      })
      .returning({ timetableId: timetable.id });

    if (!newTimetable) {
      throw new Error('Failed to insert new timetable.');
    }
    const { timetableId } = newTimetable;

    const [periodMap, dayMap, subjectMap, teacherMap, classroomMap] =
      await Promise.all([
        loadPeriods(tx, xmlDoc),
        loadDays(tx, xmlDoc),
        loadSubjects(tx, xmlDoc),
        loadTeachers(tx, xmlDoc),
        loadClassrooms(tx, xmlDoc),
      ]);

    const cohortMap = await loadCohort(tx, xmlDoc, teacherMap, timetableId);

    const lessons = await loadLessons(
      tx,
      xmlDoc,
      {
        classroomMap,
        cohortMap,
        dayMap,
        periodMap,
        subjectMap,
        teacherMap,
      },
      timetableId
    );

    logger.info('Finished timetable import', {
      classrooms: classroomMap.size,
      cohorts: cohortMap.size,
      days: dayMap.size,
      durationMs: Date.now() - startedAt,
      lessons: lessons.size,
      periods: periodMap.size,
      subjects: subjectMap.size,
      teachers: teacherMap.size,
      timetableId,
    });
  });

const loadPeriods = async (
  tx: TxClient,
  xmlDoc: Document
): Promise<Map<string, string>> => {
  logger.trace('Loading periods from XML');
  const result: Map<string, string> = new Map();
  const unique: Map<string, { period: number; start: string; end: string }> =
    new Map();
  const periods = xmlDoc.getElementsByTagName('period');

  for (let i = 0; i < periods.length; i++) {
    const period = periods.item(i);
    if (!period) {
      continue;
    }

    const predefinedId = period.getAttribute('period');
    const endTime = period.getAttribute('endtime');
    const startTime = period.getAttribute('starttime');

    if (!(predefinedId && startTime && endTime)) {
      throw new Error(
        'Incomplete data for period, unable to get all attributes'
      );
    }

    unique.set(predefinedId, {
      end: endTime,
      period: Number(predefinedId),
      start: startTime,
    });
  }

  const periodNumbers = Array.from(unique.values()).map((p) => p.period);
  if (periodNumbers.length) {
    const existing = await tx
      .select({ id: periodSchema.id, period: periodSchema.period })
      .from(periodSchema)
      .where(inArray(periodSchema.period, periodNumbers));

    for (const row of existing) {
      const key = `${row.period}`;
      if (unique.has(key)) {
        result.set(key, row.id);
        unique.delete(key);
      }
    }
  }

  const toInsert = Array.from(unique.entries()).map(([, value]) => ({
    endTime: value.end,
    id: crypto.randomUUID(),
    period: value.period,
    startTime: value.start,
  }));

  if (toInsert.length) {
    const inserted = await tx
      .insert(periodSchema)
      .values(toInsert)
      .returning({ id: periodSchema.id, period: periodSchema.period });
    for (const row of inserted) {
      result.set(`${row.period}`, row.id);
    }
  }

  logger.trace('Loaded periods', { total: result.size });
  return result;
};

type DayAttributes = { name: string; short: string };

const collectUniqueDays = (xmlDoc: Document): Map<string, DayAttributes> => {
  logger.trace('Collecting day definitions from XML');
  const unique: Map<string, DayAttributes> = new Map();
  const days = xmlDoc.getElementsByTagName('day');
  for (let i = 0; i < days.length; i++) {
    const day = days.item(i);
    if (!day) {
      continue;
    }
    const predefinedId = day.getAttribute('day');
    const name = day.getAttribute('name');
    const short = day.getAttribute('short');
    if (!(name && predefinedId && short)) {
      throw new Error('Incomplete data for day, unable to get all attributes');
    }
    unique.set(predefinedId, { name, short });
  }
  return unique;
};

const matchExistingDays = async (
  tx: TxClient,
  unique: Map<string, DayAttributes>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const names = Array.from(unique.values()).map((d) => d.name);
  if (!names.length) {
    return result;
  }

  const existing = await tx
    .select({ id: daySchema.id, name: daySchema.name })
    .from(daySchema)
    .where(inArray(daySchema.name, names));

  for (const row of existing) {
    for (const [predefinedId, data] of unique) {
      if (data.name === row.name) {
        result.set(predefinedId, row.id);
      }
    }
  }

  return result;
};

const insertMissingDays = async (
  tx: TxClient,
  missing: Map<string, DayAttributes>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  if (!missing.size) {
    return result;
  }

  const toInsert = Array.from(missing.entries()).map(
    ([predefinedId, data]) => ({
      days: [predefinedId],
      id: crypto.randomUUID(),
      name: data.name,
      short: data.short,
    })
  );

  const inserted = await tx
    .insert(daySchema)
    .values(toInsert)
    .returning({ id: daySchema.id, name: daySchema.name });

  for (const row of inserted) {
    const match = Array.from(missing.entries()).find(
      ([, data]) => data.name === row.name
    );
    if (match) {
      const [predefinedId] = match;
      result.set(predefinedId, row.id);
    }
  }

  return result;
};

const loadDays = async (
  tx: TxClient,
  xmlDoc: Document
): Promise<Map<string, string>> => {
  const unique = collectUniqueDays(xmlDoc);
  const result = await matchExistingDays(tx, unique);
  const missing = new Map(
    Array.from(unique.entries()).filter(
      ([predefinedId]) => !result.has(predefinedId)
    )
  );

  const inserted = await insertMissingDays(tx, missing);
  for (const [predefinedId, id] of inserted) {
    result.set(predefinedId, id);
  }

  return result;
};

type SubjectAttributes = { name: string; short: string };

const collectUniqueSubjects = (
  xmlDoc: Document
): Map<string, SubjectAttributes> => {
  logger.trace('Collecting subject definitions from XML');
  const unique: Map<string, SubjectAttributes> = new Map();
  const subjects = xmlDoc.getElementsByTagName('subject');
  for (let i = 0; i < subjects.length; i++) {
    const subject = subjects.item(i);
    if (!subject) {
      continue;
    }
    const predefinedId = subject.getAttribute('id');
    const name = subject.getAttribute('name');
    const short = subject.getAttribute('short');
    if (!(name && predefinedId && short)) {
      throw new Error(
        `incomplete data for subject, unable to get all attributes: id=${predefinedId}, name=${name}, short=${short}`
      );
    }
    unique.set(predefinedId, { name, short });
  }
  return unique;
};

const matchExistingSubjects = async (
  tx: TxClient,
  unique: Map<string, SubjectAttributes>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const names = Array.from(unique.values()).map((s) => s.name);
  if (!names.length) {
    return result;
  }

  const existing = await tx
    .select({ id: subjectSchema.id, name: subjectSchema.name })
    .from(subjectSchema)
    .where(inArray(subjectSchema.name, names));

  for (const row of existing) {
    const match = Array.from(unique.entries()).find(
      ([, data]) => data.name === row.name
    );
    if (match) {
      const [predefinedId] = match;
      result.set(predefinedId, row.id);
    }
  }

  return result;
};

const insertMissingSubjects = async (
  tx: TxClient,
  missing: Map<string, SubjectAttributes>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  if (!missing.size) {
    return result;
  }

  const toInsert = Array.from(missing.entries()).map(
    ([_predefinedId, data]) => ({
      id: crypto.randomUUID(),
      name: data.name,
      short: data.short,
    })
  );

  const inserted = await tx
    .insert(subjectSchema)
    .values(toInsert)
    .returning({ id: subjectSchema.id, name: subjectSchema.name });

  for (const row of inserted) {
    const match = Array.from(missing.entries()).find(
      ([, data]) => data.name === row.name
    );
    if (match) {
      const [predefinedId] = match;
      result.set(predefinedId, row.id);
    }
  }

  return result;
};

const loadSubjects = async (
  tx: TxClient,
  xmlDoc: Document
): Promise<Map<string, string>> => {
  const unique = collectUniqueSubjects(xmlDoc);
  const result = await matchExistingSubjects(tx, unique);
  logger.trace('Loading lessons from schedules');
  const missing = new Map(
    Array.from(unique.entries()).filter(
      ([predefinedId]) => !result.has(predefinedId)
    )
  );

  const inserted = await insertMissingSubjects(tx, missing);
  for (const [predefinedId, id] of inserted) {
    result.set(predefinedId, id);
  }

  return result;
};

const loadTeachers = async (
  tx: TxClient,
  xmlDoc: Document
): Promise<Map<string, string>> => {
  logger.trace('Loading teachers from XML');
  const result: Map<string, string> = new Map();
  const unique: Map<
    string,
    { firstName: string; lastName: string; short: string }
  > = new Map();
  const teachers = xmlDoc.getElementsByTagName('teacher');

  for (let i = 0; i < teachers.length; i++) {
    const teacher = teachers.item(i);
    if (!teacher) {
      continue;
    }

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
    unique.set(predefinedId, {
      firstName: names.firstName,
      lastName: names.restOfName,
      short,
    });
  }

  const lastNames = Array.from(unique.values()).map((t) => t.lastName);
  const existing = lastNames.length
    ? await tx
        .select({
          firstName: teacherSchema.firstName,
          id: teacherSchema.id,
          lastName: teacherSchema.lastName,
        })
        .from(teacherSchema)
        .where(inArray(teacherSchema.lastName, lastNames))
    : [];

  const byNameKey = new Map<string, string>();
  for (const row of existing) {
    byNameKey.set(`${row.firstName}|${row.lastName}`, row.id);
  }

  for (const [predefinedId, data] of unique) {
    const key = `${data.firstName}|${data.lastName}`;
    const existingId = byNameKey.get(key);
    if (existingId) {
      result.set(predefinedId, existingId);
      continue;
    }

    const [insertedTeacher] = await tx
      .insert(teacherSchema)
      .values({
        firstName: data.firstName,
        id: crypto.randomUUID(),
        lastName: data.lastName,
        short: data.short,
        // gender,
      })
      .returning({ insertedId: teacherSchema.id });

    if (insertedTeacher) {
      result.set(predefinedId, insertedTeacher.insertedId);
      byNameKey.set(key, insertedTeacher.insertedId);
    }
  }

  logger.trace('Loaded teachers', { total: result.size });
  return result;
};

const mapMaybeId = (
  sourceId: string | null,
  map: Map<string, string>,
  acc: string[]
) => {
  if (!sourceId) {
    return;
  }
  const mapped = map.get(sourceId);
  if (mapped) {
    acc.push(mapped);
  }
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

const getOrCreateBuilding = async (
  tx: TxClient,
  name: string
): Promise<string> => {
  const [existing] = await tx
    .select()
    .from(buildingSchema)
    .where(eq(buildingSchema.name, name))
    .limit(1);
  if (existing) {
    return existing.id;
  }
  const [inserted] = await tx
    .insert(buildingSchema)
    .values({ id: crypto.randomUUID(), name })
    .returning({ insertedId: buildingSchema.id });
  if (!inserted) {
    throw new Error('Failed to insert building');
  }
  return inserted.insertedId;
};

const upsertClassroom = async (
  tx: TxClient,
  buildingId: string,
  attrs: { id: string; name: string; short: string; capacityStr: string }
): Promise<[predefinedId: string, dbId: string] | null> => {
  const capacity =
    attrs.capacityStr === '*' ? null : Number.parseInt(attrs.capacityStr, 10);
  const [existing] = await tx
    .select()
    .from(classroomSchema)
    .where(eq(classroomSchema.name, attrs.name))
    .limit(1);
  if (existing) {
    return [attrs.id, existing.id];
  }
  const [inserted] = await tx
    .insert(classroomSchema)
    .values({
      buildingId,
      capacity,
      id: crypto.randomUUID(),
      name: attrs.name,
      short: attrs.short,
    })
    .returning({ insertedId: classroomSchema.id });
  if (!inserted) {
    return null;
  }
  return [attrs.id, inserted.insertedId];
};

const loadClassrooms = async (
  tx: TxClient,
  xmlDoc: Document
): Promise<Map<string, string>> => {
  logger.trace('Loading classrooms from XML');
  const result: Map<string, string> = new Map();
  const buildingId = await getOrCreateBuilding(tx, 'A');
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
    const upserted = await upsertClassroom(tx, buildingId, {
      capacityStr,
      id: predefinedId,
      name,
      short,
    });
    if (upserted) {
      const [pre, dbId] = upserted;
      result.set(pre, dbId);
    }
  }
  logger.trace('Loaded classrooms', { total: result.size });
  return result;
};

// --- Cohorts -----------------------------------------------------------

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
  return { name, predefinedId, short, teacherId };
};

const upsertCohort = async (
  tx: TxClient,
  attrs: CohortAttributes,
  timetableId: string
): Promise<[string, string] | null> => {
  const [existing] = await tx
    .select()
    .from(cohortSchema)
    .where(
      and(
        eq(cohortSchema.name, attrs.name),
        eq(cohortSchema.timetableId, timetableId)
      )
    )
    .limit(1);
  if (existing) {
    return [attrs.predefinedId, existing.id];
  }
  if (!attrs.teacherId) {
    return null;
  }
  const [inserted] = await tx
    .insert(cohortSchema)
    .values({
      id: crypto.randomUUID(),
      name: attrs.name,
      short: attrs.short,
      teacherId: attrs.teacherId,
      timetableId,
    })
    .returning({ insertedId: cohortSchema.id });
  if (!inserted) {
    return null;
  }
  return [attrs.predefinedId, inserted.insertedId];
};

const loadCohort = async (
  tx: TxClient,
  xmlDoc: Document,
  teacherMap: Map<string, string>,
  timetableId: string
): Promise<Map<string, string>> => {
  logger.trace('Loading cohorts from XML');
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
    const upserted = await upsertCohort(tx, attrs, timetableId);
    if (upserted) {
      const [pre, dbId] = upserted;
      result.set(pre, dbId);
    }
  }
  logger.trace('Loaded cohorts', { total: result.size });
  return result;
};

// --- Lessons -----------------------------------------------------------

const ensureWeekDefinition = async (
  tx: TxClient,
  weekName: string
): Promise<string> => {
  const [existing] = await tx
    .select()
    .from(weekSchema)
    .where(eq(weekSchema.name, weekName))
    .limit(1);
  if (existing) {
    return existing.id;
  }
  const [inserted] = await tx
    .insert(weekSchema)
    .values({
      createdAt: new Date(),
      id: crypto.randomUUID(),
      name: weekName,
      short: weekName,
      updatedAt: new Date(),
      weeks: [],
    })
    .returning({ insertedId: weekSchema.id });
  if (!inserted) {
    throw new Error('Failed to insert week definition');
  }
  return inserted.insertedId;
};

const makeLessonKey = (args: {
  subjectId: string;
  dayDefinitionId: string;
  weekDefinitionId: string;
  periodId: string;
  cohortIds: string[];
  teacherIds: string[];
  classroomIds: string[];
}): string => {
  const { subjectId, dayDefinitionId, weekDefinitionId, periodId } = args;
  const cohorts = [...args.cohortIds].sort().join(',');
  const teachers = [...args.teacherIds].sort().join(',');
  const classrooms = [...args.classroomIds].sort().join(',');
  return [
    subjectId,
    dayDefinitionId,
    weekDefinitionId,
    periodId,
    cohorts,
    teachers,
    classrooms,
  ].join('|');
};

const loadExistingLessonCohorts = async (
  tx: TxClient,
  lessonIds: string[]
): Promise<Map<string, string[]>> => {
  const map: Map<string, string[]> = new Map();
  if (!lessonIds.length) {
    return map;
  }
  const rows = await tx
    .select({
      cohortId: lessonCohortMTM.cohortId,
      lessonId: lessonCohortMTM.lessonId,
    })
    .from(lessonCohortMTM)
    .where(inArray(lessonCohortMTM.lessonId, lessonIds));

  for (const row of rows) {
    const current = map.get(row.lessonId) ?? [];
    current.push(row.cohortId);
    map.set(row.lessonId, current);
  }

  for (const [lessonId, cohortIds] of map) {
    map.set(lessonId, Array.from(new Set(cohortIds)).sort());
  }

  return map;
};

const hydrateExistingLessons = async (
  tx: TxClient,
  timetableId: string,
  lessonKeySet: Set<string>
): Promise<Map<string, string>> => {
  const existingLessons = await tx
    .select({
      classroomIds: lessonSchema.classroomIds,
      dayDefinitionId: lessonSchema.dayDefinitionId,
      id: lessonSchema.id,
      periodId: lessonSchema.periodId,
      subjectId: lessonSchema.subjectId,
      teacherIds: lessonSchema.teacherIds,
      weekDefinitionId: lessonSchema.weeksDefinitionId,
    })
    .from(lessonSchema)
    .where(eq(lessonSchema.timetableId, timetableId));

  const lessonIds = existingLessons.map((l) => l.id);
  const existingCohorts = await loadExistingLessonCohorts(tx, lessonIds);

  const result = new Map<string, string>();
  for (const lesson of existingLessons) {
    const key = makeLessonKey({
      classroomIds: ((lesson.classroomIds ?? []) as string[]) ?? [],
      cohortIds: existingCohorts.get(lesson.id) ?? [],
      dayDefinitionId: lesson.dayDefinitionId,
      periodId: lesson.periodId,
      subjectId: lesson.subjectId,
      teacherIds: ((lesson.teacherIds ?? []) as string[]) ?? [],
      weekDefinitionId: lesson.weekDefinitionId,
    });
    if (lessonKeySet.size === 0 || lessonKeySet.has(key)) {
      result.set(key, lesson.id);
    }
  }
  return result;
};

type LessonDraft = {
  key: string;
  row: LessonRowDraft;
  cohortIds: string[];
  scheduleKey: string;
};

const processSchedule = (options: {
  index: number;
  schedule: Element;
  maps: LessonMaps;
  weekDefinitionId: string;
  timetableId: string;
}): LessonDraft | null => {
  const { index, schedule, maps, weekDefinitionId, timetableId } = options;
  const dayId = schedule.getAttribute('DayID');
  const subjectGradeId = schedule.getAttribute('SubjectGradeID');
  const period = schedule.getAttribute('Period');
  const classId = schedule.getAttribute('ClassID');
  const optionalClassId = schedule.getAttribute('OptionalClassID');
  const teacherId = schedule.getAttribute('TeacherID');
  const schoolRoomId = schedule.getAttribute('SchoolRoomID');

  if (!(dayId && subjectGradeId && period)) {
    return null;
  }

  const periodId = maps.periodMap.get(period);
  if (!periodId) {
    logger.error(`Period: ${period} not found in periodMap.`);
    return null;
  }

  const subjectId = maps.subjectMap.get(subjectGradeId);
  const dayDefinitionId = maps.dayMap.get(dayId);
  if (!(subjectId && dayDefinitionId)) {
    return null;
  }

  const cohortIds: string[] = [];
  mapMaybeId(classId, maps.cohortMap, cohortIds);
  mapMaybeId(optionalClassId, maps.cohortMap, cohortIds);

  const teacherIds: string[] = [];
  mapMaybeId(teacherId, maps.teacherMap, teacherIds);

  const classroomIds: string[] = [];
  mapMaybeId(schoolRoomId, maps.classroomMap, classroomIds);

  const row: LessonRowDraft = {
    classroomIds,
    dayDefinitionId,
    groupsIds: [],
    id: crypto.randomUUID(),
    periodId,
    periodsPerWeek: 1,
    subjectId,
    teacherIds,
    termDefinitionId: null,
    timetableId,
    weeksDefinitionId: weekDefinitionId,
  };

  const key = makeLessonKey({
    classroomIds,
    cohortIds,
    dayDefinitionId,
    periodId,
    subjectId,
    teacherIds,
    weekDefinitionId,
  });

  return { cohortIds, key, row, scheduleKey: `${index}` };
};

const insertChunked = async <T>(
  items: T[],
  chunkSize: number,
  insertFn: (chunk: T[]) => Promise<void>
): Promise<void> => {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await insertFn(chunk);
  }
};

const LESSON_INSERT_CHUNK = 100;

const loadLessons = async (
  tx: TxClient,
  xmlDoc: Document,
  maps: LessonMaps,
  timetableId: string
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const weekDefinitionId = await ensureWeekDefinition(tx, 'A');
  const schedules = xmlDoc.getElementsByTagName('TimeTableSchedule');

  const drafts: LessonDraft[] = [];
  for (let i = 0; i < schedules.length; i++) {
    const schedule = schedules.item(i);
    if (!schedule) {
      continue;
    }
    const processed = processSchedule({
      index: i,
      maps,
      schedule,
      timetableId,
      weekDefinitionId,
    });
    if (processed) {
      drafts.push(processed);
    }
  }

  if (!drafts.length) {
    return result;
  }

  logger.trace('Prepared lesson drafts', { drafts: drafts.length });

  const existingByKey = await hydrateExistingLessons(
    tx,
    timetableId,
    new Set(drafts.map((d) => d.key))
  );

  logger.trace('Hydrated existing lessons', { existing: existingByKey.size });

  for (const draft of drafts) {
    const existingId = existingByKey.get(draft.key);
    if (existingId) {
      result.set(draft.scheduleKey, existingId);
    }
  }

  const toInsert = drafts.filter((d) => !existingByKey.has(d.key));
  if (!toInsert.length) {
    return result;
  }

  logger.trace('Inserting new lessons', { toInsert: toInsert.length });

  await insertChunked(toInsert, LESSON_INSERT_CHUNK, async (chunk) => {
    const rows = chunk.map((item) => item.row);
    const inserted = await tx
      .insert(lessonSchema)
      .values(rows)
      .returning({ id: lessonSchema.id });

    const idMap = new Map<string, string>();
    for (const row of inserted) {
      idMap.set(row.id, row.id);
    }

    const mtmRows: Array<{ cohortId: string; lessonId: string }> = [];
    for (const item of chunk) {
      const lessonId = idMap.get(item.row.id) ?? item.row.id;
      result.set(item.scheduleKey, lessonId);
      for (const cohortId of item.cohortIds) {
        mtmRows.push({ cohortId, lessonId });
      }
    }

    if (mtmRows.length) {
      await tx.insert(lessonCohortMTM).values(mtmRows);
    }
  });

  return result;
};
