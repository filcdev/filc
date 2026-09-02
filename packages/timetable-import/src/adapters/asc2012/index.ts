import { XMLParser } from 'fast-xml-parser';
import { decode } from 'iconv-lite';
import { z } from 'zod';
import type {
  ClassroomInput,
  CohortInput,
  DayInput,
  GroupInput,
  LessonInput,
  PeriodInput,
  SubjectInput,
  TeacherInput,
  TermInput,
  TimetableImportModel,
  WeekInput,
} from '../../types';
import { normalizeName, type TimetableImportLogger } from '../../types';
import type { TimetableImportAdapter } from '../registry';
import { ascExportRootSchema } from './schema';

type AscExportRoot = z.infer<typeof ascExportRootSchema>;
type AscTimetable = AscExportRoot['timetable'];
type AscLesson = NonNullable<AscTimetable['lessons']>['lesson'][number];
type AscDayDef = AscTimetable['daysdefs']['daysdef'][number];
type AscWeekDef = AscTimetable['weeksdefs']['weeksdef'][number];
type AscTermDef = AscTimetable['termsdefs']['termsdef'][number];

const UTF8_HEADER_RE = /encoding\s*=\s*["']utf-?8["']/i;

const ASC_ARRAY_TAGS = new Set([
  'card',
  'class',
  'classroom',
  'daysdef',
  'grade',
  'group',
  'lesson',
  'period',
  'subject',
  'teacher',
  'termsdef',
  'weeksdef',
]);

const splitIds = (ids: string): string[] =>
  ids
    .split(',')
    .map((id) => id.trim())
    .filter((id): id is string => Boolean(id));

type BaseContext = {
  classrooms: ClassroomInput[];
  cohorts: CohortInput[];
  days: DayInput[];
  groups: GroupInput[];
  periods: PeriodInput[];
  subjects: SubjectInput[];
  teachers: TeacherInput[];
  terms: TermInput[];
  weeks: WeekInput[];
  dayByMask: Map<string, string>;
  dayById: Map<string, AscDayDef>;
  weekNameById: Map<string, string>;
  termNameById: Map<string, string>;
  lessonById: Map<string, AscLesson>;
};

const normalizeBase = (tt: AscTimetable): BaseContext => {
  const periods: PeriodInput[] = (tt.periods.period ?? []).map((p) => ({
    endTime: p._endtime,
    id: p._period,
    period: Number(p._period),
    startTime: p._starttime,
  }));

  const days: DayInput[] = (tt.daysdefs.daysdef ?? []).map((d) => ({
    id: d._id,
    name: d._name,
    short: d._short,
  }));
  const dayByMask = new Map(
    (tt.daysdefs.daysdef ?? []).map((d: AscDayDef) => [d._days, d._id])
  );
  const dayById = new Map((tt.daysdefs.daysdef ?? []).map((d) => [d._id, d]));

  const weeks: WeekInput[] = (tt.weeksdefs.weeksdef ?? []).map((w) => ({
    id: w._id,
    name: w._name,
    short: w._short,
    weeks: splitIds(w._weeks),
  }));
  const weekNameById = new Map(
    (tt.weeksdefs.weeksdef ?? []).map((w: AscWeekDef) => [w._id, w._name])
  );

  const terms: TermInput[] = (tt.termsdefs.termsdef ?? []).map((t) => ({
    id: t._id,
    name: t._name,
    short: t._short,
    terms: splitIds(t._terms),
  }));
  const termNameById = new Map(
    (tt.termsdefs.termsdef ?? []).map((t: AscTermDef) => [t._id, t._name])
  );

  const subjects: SubjectInput[] = (tt.subjects.subject ?? []).map((s) => ({
    id: s._id,
    name: normalizeName(s._name),
    short: s._short,
  }));

  const teachers: TeacherInput[] = (tt.teachers.teacher ?? []).map((t) => ({
    firstName: normalizeName(t._firstname),
    id: t._id,
    lastName: normalizeName(t._lastname),
    short: t._short || '-',
  }));

  const classrooms: ClassroomInput[] = (tt.classrooms.classroom ?? []).map(
    (c) => ({
      capacity: c._capacity === '*' ? null : Number.parseInt(c._capacity, 10),
      id: c._id,
      name: normalizeName(c._name),
      short: c._short,
    })
  );

  const cohorts: CohortInput[] = (tt.classes.class ?? []).map((c) => ({
    id: c._id,
    name: normalizeName(c._name),
    short: c._short,
    teacherId: c._teacherid || null,
  }));

  const groups: GroupInput[] = (tt.groups?.group ?? []).map((g) => {
    const entireClass = g._entireclass === '1';
    let divisionTag: string | null = null;
    if (!entireClass && g._divisiontag) {
      divisionTag = String(g._divisiontag);
    }
    return {
      cohortId: g._classid,
      divisionTag,
      entireClass,
      id: g._id,
      name: g._name,
      studentCount: g._studentcount ? Number(g._studentcount) : null,
      teacherId: null,
    };
  });

  const lessonById = new Map(
    (tt.lessons?.lesson ?? []).map((l: AscLesson) => [l._id, l])
  );

  return {
    classrooms,
    cohorts,
    dayById,
    dayByMask,
    days,
    groups,
    lessonById,
    periods,
    subjects,
    teachers,
    termNameById,
    terms,
    weekNameById,
    weeks,
  };
};

type AscCard = NonNullable<AscTimetable['cards']>['card'][number];

/**
 * Map a single aSc `<card>` (a scheduled placement) to a lesson draft.
 * Returns `null` (with a diagnostic log) when the card cannot be placed, so an
 * import no longer silently drops cards.
 */
const cardToLesson = (
  card: AscCard,
  ctx: BaseContext,
  logger?: TimetableImportLogger
): LessonInput | null => {
  const lesson = ctx.lessonById.get(card._lessonid);
  if (!lesson) {
    logger?.debug('Skipped aSc card: unknown lesson', {
      lessonId: card._lessonid,
    });
    return null;
  }
  const dayId =
    ctx.dayByMask.get(card._days) ?? ctx.dayById.get(lesson._daysdefid)?._id;
  if (!dayId) {
    logger?.debug('Skipped aSc card: no day resolved', {
      lessonId: card._lessonid,
    });
    return null;
  }
  const weeksName = lesson._weeksdefid
    ? (ctx.weekNameById.get(lesson._weeksdefid) ?? '')
    : '';
  if (!weeksName) {
    logger?.debug('Skipped aSc card: no week definition', {
      lessonId: card._lessonid,
    });
    return null;
  }
  const termsName = lesson._termsdefid
    ? (ctx.termNameById.get(lesson._termsdefid) ?? '')
    : null;
  const cardClassroomIds = splitIds(card._classroomids);
  const periodsPerWeek = Number(lesson._periodsperweek);
  return {
    classroomIds: cardClassroomIds.length
      ? cardClassroomIds
      : splitIds(lesson._classroomids),
    cohortIds: splitIds(lesson._classids),
    dayId,
    groupIds: splitIds(lesson._groupids),
    id: `${lesson._id}:${card._period}:${card._days}`,
    periodId: card._period,
    periodsPerWeek: periodsPerWeek > 0 ? Math.round(periodsPerWeek) : 1,
    subjectId: lesson._subjectid,
    teacherIds: splitIds(lesson._teacherids),
    termId: termsName,
    weekId: weeksName,
  };
};

const buildLessons = (
  tt: AscTimetable,
  ctx: BaseContext,
  logger?: TimetableImportLogger
): LessonInput[] => {
  const lessons: LessonInput[] = [];
  for (const card of tt.cards?.card ?? []) {
    const lesson = cardToLesson(card, ctx, logger);
    if (lesson) {
      lessons.push(lesson);
    }
  }
  return lessons;
};

const toModel = (
  root: AscExportRoot,
  logger?: TimetableImportLogger
): TimetableImportModel => {
  const tt = root.timetable;
  const ctx = normalizeBase(tt);
  return {
    classrooms: ctx.classrooms,
    cohorts: ctx.cohorts,
    days: ctx.days,
    groups: ctx.groups,
    lessons: buildLessons(tt, ctx, logger),
    periods: ctx.periods,
    subjects: ctx.subjects,
    teachers: ctx.teachers,
    terms: ctx.terms,
    weeks: ctx.weeks,
  };
};

/** Decode aSc XML bytes, honoring a UTF-8 prolog and falling back to windows-1250. */
const decodeXml = (input: Uint8Array): string => {
  const head = new TextDecoder('ascii').decode(input.slice(0, 256));
  return UTF8_HEADER_RE.test(head)
    ? new TextDecoder('utf-8', { fatal: false }).decode(input)
    : decode(input, 'win1250');
};

/**
 * Parse raw aSc Timetables 2012 XML bytes (as produced by the aSc web export
 * and the desktop `aSc Timetables 2012 XML` export) into the normalized import
 * model. The document may be UTF-8 or windows-1250 encoded.
 */
export const parseAsc2012 = (
  input: Uint8Array,
  logger?: TimetableImportLogger
): TimetableImportModel => {
  const parser = new XMLParser({
    attributeNamePrefix: '_',
    ignoreAttributes: false,
    isArray: (tag: string) => ASC_ARRAY_TAGS.has(tag),
    parseAttributeValue: false,
    parseTagValue: true,
    textNodeName: 'text',
    trimValues: true,
  });
  const parsed = parser.parse(decodeXml(input)) as {
    timetable?: unknown;
  } | null;
  const root = z.parse(ascExportRootSchema, parsed);
  return toModel(root, logger);
};

export const asc2012TimetableImportAdapter: TimetableImportAdapter = {
  detect(input: Uint8Array): boolean {
    const head = new TextDecoder('ascii').decode(input.slice(0, 4096));
    return head.includes('<daysdefs') && !head.includes('TimeTableSchedule');
  },
  format: 'asc2012',
  mimeTypes: ['text/xml', 'application/xml'],
  parse: parseAsc2012,
};
