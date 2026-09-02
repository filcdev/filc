import dayjs from 'dayjs';
import type { LessonCohortRow, NewLesson, TimetableImportStore } from './store';
import type {
  TermInput,
  TimetableImportLogger,
  TimetableImportModel,
  TimetableImportOptions,
  WeekInput,
} from './types';

const randomId = (): string => crypto.randomUUID();

const noop = (): undefined => undefined;

const silentLogger: TimetableImportLogger = {
  debug: noop,
  error: noop,
  info: noop,
  trace: noop,
};

type LessonMaps = {
  subjectMap: Map<string, string>;
  cohortMap: Map<string, string>;
  teacherMap: Map<string, string>;
  classroomMap: Map<string, string>;
  dayMap: Map<string, string>;
  periodMap: Map<string, string>;
};

type LessonDraft = {
  key: string;
  row: NewLesson;
  cohortIds: string[];
  scheduleKey: string;
};

const LESSON_INSERT_CHUNK = 100;

const makeLessonKey = (args: {
  subjectId: string;
  dayDefinitionId: string;
  weekDefinitionId: string;
  periodId: string;
  cohortIds: string[];
  teacherIds: string[];
  classroomIds: string[];
  groupsIds: string[];
  termDefinitionId: string | null;
}): string => {
  const { subjectId, dayDefinitionId, weekDefinitionId, periodId } = args;
  const cohorts = [...args.cohortIds].sort().join(',');
  const teachers = [...args.teacherIds].sort().join(',');
  const classrooms = [...args.classroomIds].sort().join(',');
  const groups = [...args.groupsIds].sort().join(',');
  return [
    subjectId,
    dayDefinitionId,
    weekDefinitionId,
    periodId,
    cohorts,
    teachers,
    classrooms,
    groups,
    args.termDefinitionId ?? '',
  ].join('|');
};

const mapMaybeId = (
  sourceId: string,
  map: Map<string, string>,
  acc: string[]
): void => {
  const mapped = map.get(sourceId);
  if (mapped) {
    acc.push(mapped);
  }
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

/**
 * Import a normalized timetable model. Runs inside a single transaction so a
 * concurrent import cannot race on the active-timetable row.
 *
 * @param model The normalized timetable produced by an adapter.
 * @param options Timetable metadata (name, validity dates).
 * @param store Persistence backend.
 * @param logger Optional diagnostic logger.
 */
export const importTimetable = <Tx>(
  model: TimetableImportModel,
  options: TimetableImportOptions,
  store: TimetableImportStore<Tx>,
  logger: TimetableImportLogger = silentLogger
): Promise<void> => {
  const buildingName = options.buildingName ?? 'A';

  return store.transaction(async (tx) => {
    const startedAt = Date.now();
    logger.info('Starting timetable import', {
      timetableName: options.name,
      validFrom: options.validFrom,
    });

    // Resolve the currently active timetable inside this transaction so a
    // concurrent import cannot race on the same row.
    const today = dayjs().format('YYYY-MM-DD');
    const validFromDay = dayjs(options.validFrom).format('YYYY-MM-DD');
    const takesEffectNow = validFromDay <= today;
    const active = await store.findActiveTimetable(tx, today);
    // Only expire a still-valid timetable when this import actually takes
    // effect today or sooner; a future-dated/draft import must not invalidate
    // the still-running timetable.
    if (active?.validTo === null && takesEffectNow) {
      const dayBefore = dayjs(options.validFrom)
        .subtract(1, 'day')
        .format('YYYY-MM-DD');
      await store.expireTimetable(tx, active.id, dayBefore);
    }

    const timetableId = await store.insertTimetable(tx, {
      id: randomId(),
      name: options.name,
      validFrom: options.validFrom,
      validTo: options.validTo ?? null,
    });

    // Cohort identity is scoped to the calendar year the timetable starts in.
    // Re-imports of the same school year reuse that year's cohorts, while a
    // new school year's rename never merges into an old (expired) cohort.
    const schoolYear = dayjs(options.validFrom).year();

    const [periodMap, dayMap, subjectMap, teacherMap, classroomMap] =
      await Promise.all([
        loadPeriods(tx, model.periods, store, logger),
        loadDays(tx, model.days, store, logger),
        loadSubjects(tx, model.subjects, store, logger),
        loadTeachers(tx, model.teachers, store, logger),
        loadClassrooms(tx, model.classrooms, store, buildingName, logger),
      ]);

    const cohortMap = await loadCohorts(
      tx,
      model.cohorts,
      teacherMap,
      timetableId,
      schoolYear,
      store,
      logger
    );

    const groupMap = await loadGroups(
      tx,
      model.groups,
      cohortMap,
      timetableId,
      store,
      logger
    );

    const lessonCount = await loadLessons(
      tx,
      model.lessons,
      { classroomMap, cohortMap, dayMap, periodMap, subjectMap, teacherMap },
      groupMap,
      model.weeks,
      model.terms,
      timetableId,
      store,
      logger
    );

    logger.info('Finished timetable import', {
      classrooms: classroomMap.size,
      cohorts: cohortMap.size,
      days: dayMap.size,
      durationMs: Date.now() - startedAt,
      lessons: lessonCount,
      periods: periodMap.size,
      subjects: subjectMap.size,
      teachers: teacherMap.size,
      timetableId,
    });
  });
};

const buildSourceIdByNumber = (
  unique: Map<string, { period: number; start: string; end: string }>
): Map<string, string> => {
  const map = new Map<string, string>();
  for (const [sourceId, value] of unique) {
    const key = `${value.period}`;
    if (!map.has(key)) {
      map.set(key, sourceId);
    }
  }
  return map;
};

const loadPeriods = async <Tx>(
  tx: Tx,
  periods: TimetableImportModel['periods'],
  store: TimetableImportStore<Tx>,
  logger: TimetableImportLogger
): Promise<Map<string, string>> => {
  logger.trace('Loading periods from XML');
  const result: Map<string, string> = new Map();
  const unique: Map<string, { period: number; start: string; end: string }> =
    new Map();

  for (const period of periods) {
    const predefinedId = period.id;
    const endTime = period.endTime;
    const startTime = period.startTime;

    if (!(predefinedId !== undefined && startTime && endTime)) {
      logger.error('Period missing attributes', {
        parsed: { endTime, predefinedId, startTime },
        period,
      });
      throw new Error(
        'Incomplete data for period, unable to get all attributes'
      );
    }

    logger.trace('Collected period', { endTime, predefinedId, startTime });
    unique.set(predefinedId, {
      end: endTime,
      period: period.period,
      start: startTime,
    });
  }

  const sourceIdsByNumber = buildSourceIdByNumber(unique);

  await matchExistingPeriods(tx, unique, sourceIdsByNumber, store, result);
  await insertRemainingPeriods(tx, unique, sourceIdsByNumber, store, result);

  logger.trace('Loaded periods', { total: result.size });
  return result;
};

// Key `periodMap` by the *source* period id (what `lesson.periodId` uses), not
// the numeric period. Period ids like `"01"` (number 1) would otherwise miss
// the lookup and the lesson would be dropped in `processLesson`.
const matchExistingPeriods = async <Tx>(
  tx: Tx,
  unique: Map<string, { period: number; start: string; end: string }>,
  sourceIdsByNumber: Map<string, string>,
  store: TimetableImportStore<Tx>,
  result: Map<string, string>
): Promise<void> => {
  const numbers = Array.from(unique.values()).map((p) => p.period);
  if (!numbers.length) {
    return;
  }
  const existing = await store.findPeriodsByNumber(tx, numbers);
  for (const row of existing) {
    const sourceId = sourceIdsByNumber.get(`${row.period}`);
    if (sourceId && unique.has(sourceId)) {
      result.set(sourceId, row.id);
      unique.delete(sourceId);
    }
  }
};

const insertRemainingPeriods = async <Tx>(
  tx: Tx,
  unique: Map<string, { period: number; start: string; end: string }>,
  sourceIdsByNumber: Map<string, string>,
  store: TimetableImportStore<Tx>,
  result: Map<string, string>
): Promise<void> => {
  const toInsert = Array.from(unique.entries()).map(([, value]) => ({
    endTime: value.end,
    id: randomId(),
    period: value.period,
    startTime: value.start,
  }));
  if (!toInsert.length) {
    return;
  }
  const inserted = await store.insertPeriods(tx, toInsert);
  for (const row of inserted) {
    const sourceId = sourceIdsByNumber.get(`${row.period}`);
    if (sourceId) {
      result.set(sourceId, row.id);
    }
  }
};

type DayAttributes = { name: string; short: string };

const collectUniqueDays = (
  days: TimetableImportModel['days']
): Map<string, DayAttributes> => {
  const unique: Map<string, DayAttributes> = new Map();

  for (const day of days) {
    const predefinedId = day.id;
    const name = day.name;
    const short = day.short;
    if (!(name && predefinedId !== undefined && short)) {
      throw new Error('Incomplete data for day, unable to get all attributes');
    }
    unique.set(predefinedId, { name, short });
  }
  return unique;
};

const matchExistingDays = async <Tx>(
  tx: Tx,
  unique: Map<string, DayAttributes>,
  store: TimetableImportStore<Tx>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const names = Array.from(unique.values()).map((d) => d.name);
  if (!names.length) {
    return result;
  }

  // Build reverse lookup from day name to one or more predefined IDs
  const nameToPredefinedIds: Map<string, string[]> = new Map();
  for (const [predefinedId, data] of unique) {
    const list = nameToPredefinedIds.get(data.name);
    if (list) {
      list.push(predefinedId);
    } else {
      nameToPredefinedIds.set(data.name, [predefinedId]);
    }
  }
  const existing = await store.findDaysByName(tx, names);
  for (const row of existing) {
    const predefinedIds = nameToPredefinedIds.get(row.name);
    if (!predefinedIds) {
      continue;
    }
    for (const predefinedId of predefinedIds) {
      result.set(predefinedId, row.id);
    }
  }

  return result;
};

const insertMissingDays = async <Tx>(
  tx: Tx,
  missing: Map<string, DayAttributes>,
  store: TimetableImportStore<Tx>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  if (!missing.size) {
    return result;
  }

  // One row per distinct name; map every source id of that name to it. The
  // `days` column stores the source day IDs (the day mask), so keep the name ->
  // source ids index rather than using the name itself.
  const byName = new Map<string, DayAttributes>();
  const sourceIdsByName = new Map<string, string[]>();
  for (const [predefinedId, data] of missing) {
    if (!byName.has(data.name)) {
      byName.set(data.name, data);
    }
    const ids = sourceIdsByName.get(data.name);
    if (ids) {
      ids.push(predefinedId);
    } else {
      sourceIdsByName.set(data.name, [predefinedId]);
    }
  }
  const toInsert = Array.from(byName.entries()).map(([name, data]) => ({
    days: sourceIdsByName.get(name) ?? [],
    id: randomId(),
    name: data.name,
    short: data.short,
  }));

  const inserted = await store.insertDays(tx, toInsert);

  for (const row of inserted) {
    for (const [predefinedId, data] of missing) {
      if (data.name === row.name) {
        result.set(predefinedId, row.id);
      }
    }
  }

  return result;
};

const loadDays = async <Tx>(
  tx: Tx,
  days: TimetableImportModel['days'],
  store: TimetableImportStore<Tx>,
  logger: TimetableImportLogger
): Promise<Map<string, string>> => {
  logger.trace('Collecting day definitions from XML');
  const unique = collectUniqueDays(days);
  const result = await matchExistingDays(tx, unique, store);
  const missing = new Map(
    Array.from(unique.entries()).filter(
      ([predefinedId]) => !result.has(predefinedId)
    )
  );

  const inserted = await insertMissingDays(tx, missing, store);
  for (const [predefinedId, id] of inserted) {
    result.set(predefinedId, id);
  }

  return result;
};

type SubjectAttributes = { name: string; short: string };

const collectUniqueSubjects = (
  subjects: TimetableImportModel['subjects']
): Map<string, SubjectAttributes> => {
  const unique: Map<string, SubjectAttributes> = new Map();

  for (const subject of subjects) {
    const predefinedId = subject.id;
    const name = subject.name;
    const short = subject.short;
    if (!(name && predefinedId && short)) {
      throw new Error(
        `incomplete data for subject, unable to get all attributes: id=${predefinedId}, name=${name}, short=${short}`
      );
    }
    unique.set(predefinedId, { name, short });
  }
  return unique;
};

const matchExistingSubjects = async <Tx>(
  tx: Tx,
  unique: Map<string, SubjectAttributes>,
  store: TimetableImportStore<Tx>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  const names = Array.from(unique.values()).map((s) => s.name);
  if (!names.length) {
    return result;
  }

  const existing = await store.findSubjectsByName(tx, names);

  // Map every source id that shares a name to that row, so duplicate names
  // don't leave source ids un-mapped (which would then insert dup rows).
  for (const row of existing) {
    for (const [predefinedId, data] of unique) {
      if (data.name === row.name) {
        result.set(predefinedId, row.id);
      }
    }
  }

  return result;
};

const insertMissingSubjects = async <Tx>(
  tx: Tx,
  missing: Map<string, SubjectAttributes>,
  store: TimetableImportStore<Tx>
): Promise<Map<string, string>> => {
  const result: Map<string, string> = new Map();
  if (!missing.size) {
    return result;
  }

  // One row per distinct name; map every source id of that name to it.
  const byName = new Map<string, SubjectAttributes>();
  for (const [, data] of missing) {
    byName.set(data.name, data);
  }
  const toInsert = Array.from(byName.values()).map((data) => ({
    id: randomId(),
    name: data.name,
    short: data.short,
  }));

  const inserted = await store.insertSubjects(tx, toInsert);

  for (const row of inserted) {
    for (const [predefinedId, data] of missing) {
      if (data.name === row.name) {
        result.set(predefinedId, row.id);
      }
    }
  }

  return result;
};

const loadSubjects = async <Tx>(
  tx: Tx,
  subjects: TimetableImportModel['subjects'],
  store: TimetableImportStore<Tx>,
  logger: TimetableImportLogger
): Promise<Map<string, string>> => {
  logger.trace('Loading subjects from XML');
  const unique = collectUniqueSubjects(subjects);
  const result = await matchExistingSubjects(tx, unique, store);
  const missing = new Map(
    Array.from(unique.entries()).filter(
      ([predefinedId]) => !result.has(predefinedId)
    )
  );

  const inserted = await insertMissingSubjects(tx, missing, store);
  for (const [predefinedId, id] of inserted) {
    result.set(predefinedId, id);
  }

  return result;
};

const loadTeachers = async <Tx>(
  tx: Tx,
  teachers: TimetableImportModel['teachers'],
  store: TimetableImportStore<Tx>,
  logger: TimetableImportLogger
): Promise<Map<string, string>> => {
  logger.trace('Loading teachers from XML');
  const result: Map<string, string> = new Map();

  const lastNames = Array.from(teachers.map((t) => t.lastName));
  const existing = lastNames.length
    ? await store.findTeachersByLastName(tx, lastNames)
    : [];

  const byNameKey = new Map<string, string>();
  for (const row of existing) {
    byNameKey.set(`${row.firstName}|${row.lastName}`, row.id);
  }

  // Collect missing teachers
  const missing: Array<{
    predefinedId: string;
    firstName: string;
    lastName: string;
    short: string;
  }> = [];

  for (const teacher of teachers) {
    const key = `${teacher.firstName}|${teacher.lastName}`;
    const existingId = byNameKey.get(key);
    if (existingId) {
      result.set(teacher.id, existingId);
    } else {
      missing.push({
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        predefinedId: teacher.id,
        short: teacher.short,
      });
    }
  }

  if (missing.length) {
    // One row per distinct full name; map every source id of that name to it.
    const seen = new Set<string>();
    const toInsert = missing
      .filter((item) => {
        const key = `${item.firstName}|${item.lastName}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .map((item) => ({
        firstName: item.firstName,
        id: randomId(),
        lastName: item.lastName,
        short: item.short,
      }));

    const inserted = await store.insertTeachers(tx, toInsert);

    const insertedByName = new Map<string, string>();
    for (const row of inserted) {
      insertedByName.set(`${row.firstName}|${row.lastName}`, row.id);
    }
    for (const item of missing) {
      const id = insertedByName.get(`${item.firstName}|${item.lastName}`);
      if (id) {
        result.set(item.predefinedId, id);
      }
    }
  }

  logger.trace('Loaded teachers', { total: result.size });
  return result;
};

const getOrCreateBuilding = async <Tx>(
  tx: Tx,
  name: string,
  store: TimetableImportStore<Tx>
): Promise<string> => {
  const existing = await store.findBuildingByName(tx, name);
  if (existing) {
    return existing;
  }
  const inserted = await store.insertBuilding(tx, name);
  if (!inserted) {
    throw new Error('Failed to insert building');
  }
  return inserted;
};

const loadClassrooms = async <Tx>(
  tx: Tx,
  classrooms: TimetableImportModel['classrooms'],
  store: TimetableImportStore<Tx>,
  buildingName: string,
  logger: TimetableImportLogger
): Promise<Map<string, string>> => {
  logger.trace('Loading classrooms from XML');
  const result: Map<string, string> = new Map();
  const buildingId = await getOrCreateBuilding(tx, buildingName, store);

  // Batch the existing-name lookup (one query for all names) and reuse one row
  // for duplicate-named classrooms instead of inserting duplicate rows.
  const existingByName = new Map<string, string>();
  const names = Array.from(
    new Set(classrooms.map((c) => c.name).filter(Boolean))
  );
  if (names.length) {
    const rows = await store.findClassroomsByName(tx, names);
    for (const row of rows) {
      existingByName.set(row.name, row.id);
    }
  }

  for (const el of classrooms) {
    const predefinedId = el.id;
    const name = el.name;
    const short = el.short;
    if (!(predefinedId && name && short)) {
      throw new Error(
        'Incomplete data for classroom, unable to get all attributes'
      );
    }
    let dbId = existingByName.get(name);
    if (!dbId) {
      const inserted = await store.insertClassroom(tx, {
        buildingId,
        capacity: el.capacity,
        id: randomId(),
        name,
        short,
      });
      dbId = inserted ?? '';
      if (dbId) {
        existingByName.set(name, dbId);
      }
    }
    if (dbId) {
      result.set(predefinedId, dbId);
    }
  }
  logger.trace('Loaded classrooms', { total: result.size });
  return result;
};

const upsertCohort = async <Tx>(
  tx: Tx,
  attrs: { name: string; short: string; teacherId: string | null },
  timetableId: string,
  year: number,
  store: TimetableImportStore<Tx>
): Promise<string | null> => {
  const existing = await store.findCohortByName(tx, attrs.name, year);

  let cohortId: string;

  if (existing) {
    cohortId = existing;
  } else {
    // Create the cohort even when it has no resolvable homeroom teacher, so
    // classes are not silently dropped from the timetable import.
    const inserted = await store.insertCohort(tx, {
      id: randomId(),
      name: attrs.name,
      short: attrs.short,
      teacherId: attrs.teacherId,
      timetableId,
    });
    if (!inserted) {
      return null;
    }
    cohortId = inserted;
  }

  await store.linkCohortToTimetable(tx, { cohortId, timetableId });

  return cohortId;
};

const loadCohorts = async <Tx>(
  tx: Tx,
  cohorts: TimetableImportModel['cohorts'],
  teacherMap: Map<string, string>,
  timetableId: string,
  year: number,
  store: TimetableImportStore<Tx>,
  logger: TimetableImportLogger
): Promise<Map<string, string>> => {
  logger.trace('Loading cohorts from XML');
  const result: Map<string, string> = new Map();

  for (const el of cohorts) {
    const predefinedId = el.id;
    const name = el.name;
    const short = el.short;
    if (!(predefinedId && name && short)) {
      continue;
    }
    const teacherId = el.teacherId
      ? (teacherMap.get(el.teacherId) ?? null)
      : null;
    const upserted = await upsertCohort(
      tx,
      { name, short, teacherId },
      timetableId,
      year,
      store
    );
    if (upserted) {
      result.set(predefinedId, upserted);
    }
  }
  logger.trace('Loaded cohorts', { total: result.size });
  return result;
};

const loadExistingGroupsByKey = async <Tx>(
  tx: Tx,
  cohortIds: string[],
  store: TimetableImportStore<Tx>
): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  if (!cohortIds.length) {
    return map;
  }
  const rows = await store.findCohortGroupsByCohorts(tx, cohortIds);
  for (const row of rows) {
    if (row.cohortId) {
      map.set(`${row.cohortId}|${row.name}`, row.id);
    }
  }
  return map;
};

const loadGroups = async <Tx>(
  tx: Tx,
  groups: TimetableImportModel['groups'],
  cohortMap: Map<string, string>,
  timetableId: string,
  store: TimetableImportStore<Tx>,
  logger: TimetableImportLogger
): Promise<Map<string, string>> => {
  logger.trace('Loading groups from XML');
  const result: Map<string, string> = new Map();

  // Batch-fetch existing groups for the mapped cohorts (one query), keyed by
  // `cohortId|name`, so duplicate-named groups reuse a row and we avoid one
  // lookup per group inside the import transaction.
  const cohortIds = Array.from(
    new Set(
      groups
        .map((group) => cohortMap.get(group.cohortId))
        .filter(Boolean) as string[]
    )
  );
  const existingByKey = await loadExistingGroupsByKey(tx, cohortIds, store);

  for (const group of groups) {
    const cohortId = cohortMap.get(group.cohortId);
    if (!cohortId) {
      continue;
    }
    const key = `${cohortId}|${group.name}`;
    let dbId = existingByKey.get(key);
    if (dbId) {
      // Re-imports may carry the authoritative aSc divisiontag; refresh the
      // stored key so the group follows the latest export.
      await store.updateCohortGroup(tx, dbId, {
        divisionTag: group.divisionTag,
      });
    } else {
      const inserted = await store.insertCohortGroup(tx, {
        cohortId,
        divisionTag: group.divisionTag,
        entireClass: group.entireClass,
        id: randomId(),
        name: group.name,
        studentCount: group.studentCount ?? 0,
        teacherId: null,
        timetableId,
      });
      dbId = inserted ?? '';
      if (dbId) {
        existingByKey.set(key, dbId);
      }
    }
    if (dbId) {
      result.set(group.id, dbId);
    }
  }
  logger.trace('Loaded groups', { total: result.size });
  return result;
};

const ensureWeekDefinition = async <Tx>(
  tx: Tx,
  week: WeekInput,
  store: TimetableImportStore<Tx>
): Promise<string> => {
  const existing = await store.findWeekDefinitionByName(tx, week.name);
  if (existing) {
    return existing;
  }
  return store.insertWeekDefinition(tx, {
    id: randomId(),
    name: week.name,
    short: week.short,
    weeks: week.weeks,
  });
};

const ensureTermDefinition = async <Tx>(
  tx: Tx,
  term: TermInput,
  store: TimetableImportStore<Tx>
): Promise<string> => {
  const existing = await store.findTermByName(tx, term.name);
  if (existing) {
    return existing;
  }
  return store.insertTerm(tx, {
    id: randomId(),
    name: term.name,
    short: term.short,
    terms: term.terms,
  });
};

const loadExistingLessonCohorts = async <Tx>(
  tx: Tx,
  lessonIds: string[],
  store: TimetableImportStore<Tx>
): Promise<Map<string, string[]>> => {
  const map: Map<string, string[]> = new Map();
  if (!lessonIds.length) {
    return map;
  }
  const rows = await store.findLessonCohorts(tx, lessonIds);

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

const hydrateExistingLessons = async <Tx>(
  tx: Tx,
  timetableId: string,
  lessonKeySet: Set<string>,
  store: TimetableImportStore<Tx>
): Promise<Map<string, string>> => {
  const existingLessons = await store.findLessonsByTimetable(tx, timetableId);

  const existingCohorts = await loadExistingLessonCohorts(
    tx,
    existingLessons.map((l) => l.id),
    store
  );

  const result = new Map<string, string>();
  for (const lesson of existingLessons) {
    const key = makeLessonKey({
      classroomIds: lesson.classroomIds ?? [],
      cohortIds: existingCohorts.get(lesson.id) ?? [],
      dayDefinitionId: lesson.dayDefinitionId,
      groupsIds: lesson.groupsIds ?? [],
      periodId: lesson.periodId,
      subjectId: lesson.subjectId,
      teacherIds: lesson.teacherIds ?? [],
      termDefinitionId: lesson.termDefinitionId ?? null,
      weekDefinitionId: lesson.weeksDefinitionId,
    });
    if (lessonKeySet.size === 0 || lessonKeySet.has(key)) {
      result.set(key, lesson.id);
    }
  }
  return result;
};

const processLesson = (
  lessonIndex: number,
  lesson: TimetableImportModel['lessons'][number],
  maps: LessonMaps,
  groupMap: Map<string, string>,
  weekMap: Map<string, string>,
  termMap: Map<string, string>,
  timetableId: string,
  logger: TimetableImportLogger
): LessonDraft | null => {
  const periodId = maps.periodMap.get(lesson.periodId);
  if (!periodId) {
    logger.error(`Period: ${lesson.periodId} not found in periodMap.`);
    return null;
  }

  const subjectId = maps.subjectMap.get(lesson.subjectId);
  const dayDefinitionId = maps.dayMap.get(lesson.dayId);
  if (!(subjectId && dayDefinitionId)) {
    logger.error('Dropping lesson: subject or day not resolved', {
      dayId: lesson.dayId,
      lessonId: lesson.id,
      subjectId: lesson.subjectId,
    });
    return null;
  }

  const cohortIds: string[] = [];
  for (const classId of lesson.cohortIds) {
    mapMaybeId(classId, maps.cohortMap, cohortIds);
  }

  const teacherIds: string[] = [];
  for (const teacherId of lesson.teacherIds) {
    mapMaybeId(teacherId, maps.teacherMap, teacherIds);
  }

  const classroomIds: string[] = [];
  for (const schoolRoomId of lesson.classroomIds) {
    mapMaybeId(schoolRoomId, maps.classroomMap, classroomIds);
  }

  const groupsIds: string[] = [];
  for (const groupId of lesson.groupIds) {
    mapMaybeId(groupId, groupMap, groupsIds);
  }

  const weeksDefinitionId = weekMap.get(lesson.weekId);
  if (!weeksDefinitionId) {
    logger.error('Dropping lesson: week definition not resolved', {
      lessonId: lesson.id,
      weekId: lesson.weekId,
    });
    return null;
  }

  const termDefinitionId = lesson.termId
    ? (termMap.get(lesson.termId) ?? null)
    : null;

  const row: NewLesson = {
    classroomIds,
    dayDefinitionId,
    groupsIds,
    id: randomId(),
    periodId,
    periodsPerWeek: lesson.periodsPerWeek ?? 1,
    subjectId,
    teacherIds,
    termDefinitionId,
    timetableId,
    weeksDefinitionId,
  };

  const key = makeLessonKey({
    classroomIds,
    cohortIds,
    dayDefinitionId,
    groupsIds,
    periodId,
    subjectId,
    teacherIds,
    termDefinitionId,
    weekDefinitionId: weeksDefinitionId,
  });

  return { cohortIds, key, row, scheduleKey: `${lessonIndex}` };
};

const loadLessons = async <Tx>(
  tx: Tx,
  lessons: TimetableImportModel['lessons'],
  maps: LessonMaps,
  groupMap: Map<string, string>,
  weeks: TimetableImportModel['weeks'],
  terms: TimetableImportModel['terms'],
  timetableId: string,
  store: TimetableImportStore<Tx>,
  logger: TimetableImportLogger
): Promise<number> => {
  const result: Map<string, string> = new Map();

  const weekMap = new Map<string, string>();
  for (const week of weeks) {
    weekMap.set(week.name, await ensureWeekDefinition(tx, week, store));
  }
  for (const weekName of new Set(lessons.map((l) => l.weekId))) {
    if (!weekMap.has(weekName)) {
      weekMap.set(
        weekName,
        await ensureWeekDefinition(
          tx,
          { id: randomId(), name: weekName, short: weekName, weeks: [] },
          store
        )
      );
    }
  }
  const termMap = new Map<string, string>();
  for (const term of terms) {
    termMap.set(term.name, await ensureTermDefinition(tx, term, store));
  }

  const drafts: LessonDraft[] = [];
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    if (!lesson) {
      continue;
    }
    const processed = processLesson(
      i,
      lesson,
      maps,
      groupMap,
      weekMap,
      termMap,
      timetableId,
      logger
    );
    if (processed) {
      drafts.push(processed);
    }
  }

  if (!drafts.length) {
    return result.size;
  }

  logger.trace('Prepared lesson drafts', { drafts: drafts.length });

  const existingByKey = await hydrateExistingLessons(
    tx,
    timetableId,
    new Set(drafts.map((d) => d.key)),
    store
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
    return result.size;
  }

  logger.trace('Inserting new lessons', { toInsert: toInsert.length });

  await insertChunked(toInsert, LESSON_INSERT_CHUNK, async (chunk) => {
    const rows = chunk.map((item) => item.row);
    await store.insertLessons(tx, rows);

    const mtmRows: LessonCohortRow[] = [];
    for (const item of chunk) {
      if (!item) {
        continue;
      }
      // Use the pre-generated id; do not rely on the DB RETURNING order.
      const lessonId = item.row.id;
      result.set(item.scheduleKey, lessonId);
      for (const cohortId of item.cohortIds) {
        mtmRows.push({ cohortId, lessonId });
      }
    }

    if (mtmRows.length) {
      await store.insertLessonCohorts(tx, mtmRows);
    }
  });

  return result.size;
};
