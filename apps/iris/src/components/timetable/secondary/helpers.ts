import { getDayOrder } from '@/utils/date-locale';
import { toHHMM } from '../helpers';
import type { LessonItem, PeriodItem } from '../types';
import type {
  SecondaryDay,
  SecondaryPeriod,
  SecondaryTimetableModel,
} from './types';

/**
 * Canonical Monday–Friday columns for the card. `label`
 * follows the paper spec's two-letter Hungarian abbreviations by default
 * (Hé, Ke, Sz, Cs, Pé) and falls back to English short forms when the UI is in
 * English.
 */
const DAY_COLUMNS: { order: number; key: string; hu: string; en: string }[] = [
  { en: 'Mon', hu: 'Hé', key: 'monday', order: 0 },
  { en: 'Tue', hu: 'Ke', key: 'tuesday', order: 1 },
  { en: 'Wed', hu: 'Sz', key: 'wednesday', order: 2 },
  { en: 'Thu', hu: 'Cs', key: 'thursday', order: 3 },
  { en: 'Fri', hu: 'Pé', key: 'friday', order: 4 },
];

const WHITESPACE = /\s+/;

/** "07:10:00" -> "7:10"; "00:00:00"/empty -> "". */
export const formatPeriodTime = (value: string | null | undefined): string => {
  const hhmm = toHHMM(value);
  if (!hhmm || hhmm === '00:00') {
    return '';
  }
  return `${Number(hhmm.slice(0, 2))}:${hhmm.slice(3, 5)}`;
};

/** Deterministic order for two lessons sharing a slot (A-week before B-week). */
const compareSlotLessons = (a: LessonItem, b: LessonItem): number => {
  const aw = a.weeksDefinitionId ?? '';
  const bw = b.weeksDefinitionId ?? '';
  if (aw !== bw) {
    return aw.localeCompare(bw);
  }
  return a.id.localeCompare(b.id);
};

/**
 * Keep only the span of period columns that actually hold a lesson, instead of
 * rendering every canonical period (e.g. all 16) with empty columns for the
 * unused ones. Intermediate empty periods are kept so the grid stays a
 * contiguous weekly timetable.
 */
const keepOccupiedSpan = (
  periods: SecondaryPeriod[],
  occupied: Set<number>
): SecondaryPeriod[] => {
  if (occupied.size === 0) {
    return periods;
  }
  const minIndex = Math.min(...occupied);
  const maxIndex = Math.max(...occupied);
  return periods.filter(
    (period) => period.index >= minIndex && period.index <= maxIndex
  );
};

/**
 * Derive the day columns, period columns, and the (day × period) lesson grid
 * for the secondary card from the raw lessons and canonical periods.
 */
export const buildSecondaryModel = (
  lessons: LessonItem[],
  periods: PeriodItem[],
  language: string | undefined
): SecondaryTimetableModel => {
  // Period columns: union of the canonical periods and any period index used by
  // a lesson, so a lesson is never silently dropped.
  const periodByIndex = new Map<number, PeriodItem>();
  for (const period of periods) {
    periodByIndex.set(period.period, period);
  }
  for (const lesson of lessons) {
    const index = lesson.period?.period;
    if (typeof index === 'number' && !periodByIndex.has(index)) {
      periodByIndex.set(index, {
        endTime: '',
        id: `${index}`,
        period: index,
        startTime: '',
      } as PeriodItem);
    }
  }

  const sortedPeriods = Array.from(periodByIndex.values()).sort(
    (a, b) => a.period - b.period
  );
  const secondaryPeriods: SecondaryPeriod[] = sortedPeriods.map((period) => ({
    endLabel: formatPeriodTime(period.endTime),
    endTime: period.endTime,
    id: period.id,
    index: period.period,
    startLabel: formatPeriodTime(period.startTime),
    startTime: period.startTime,
  }));

  const isEnglish = (language ?? 'hu').toLowerCase().startsWith('en');
  const days: SecondaryDay[] = DAY_COLUMNS.map((day) => ({
    key: day.key,
    label: isEnglish ? day.en : day.hu,
    order: day.order,
  }));

  // Group lessons by (day order, period index).
  const grid = new Map<string, LessonItem[]>();
  const occupiedPeriodIndices = new Set<number>();
  for (const lesson of lessons) {
    const dayOrder = getDayOrder(lesson.day?.name ?? '', lesson.day?.short);
    if (dayOrder < 0 || dayOrder > 4) {
      continue;
    }
    const periodIndex = lesson.period?.period;
    if (typeof periodIndex !== 'number') {
      continue;
    }

    occupiedPeriodIndices.add(periodIndex);
    const key = `${dayOrder}|${periodIndex}`;
    const slot = grid.get(key) ?? [];
    slot.push(lesson);
    grid.set(key, slot);
  }

  // Stable ordering within a slot (A-week on top, B-week below).
  for (const slot of grid.values()) {
    slot.sort(compareSlotLessons);
  }

  return {
    days,
    grid,
    periods: keepOccupiedSpan(secondaryPeriods, occupiedPeriodIndices),
  };
};

/** Subject label shown in the cell centre (falls back to the full name). */
export const formatSubjectShort = (lesson: LessonItem): string =>
  lesson.subject?.short ?? lesson.subject?.name ?? '—';

/** Full subject name used in the tooltip. */
export const formatSubjectName = (lesson: LessonItem): string =>
  lesson.subject?.name ?? lesson.subject?.short ?? '';

/** Teacher surname only, for the bottom-right corner of a cell. */
export const formatTeacherSurname = (lesson: LessonItem): string => {
  const teacher = lesson.teachers?.[0];
  if (!teacher) {
    return '';
  }
  const short = teacher.short?.trim() ?? '';
  if (short && !short.includes(' ')) {
    return short;
  }
  const parts = (teacher.name ?? short).split(WHITESPACE).filter(Boolean);
  return parts.at(-1) ?? '';
};

/** Room code for the bottom-left corner; "I. EA" when no room is set. */
export const formatRoomCode = (lesson: LessonItem): string =>
  lesson.classrooms?.[0]?.short ?? 'I. EA';

/**
 * Group/division code for the top-right corner of split cells (e.g. "mat1",
 * "tesi2"). The cohort short prefix is stripped so a group named
 * "11.D angol1" yields "angol1".
 */
export const formatGroupCode = (
  lesson: LessonItem,
  cohortShort?: string
): string => {
  const groups = lesson.groups ?? [];
  const splitGroups = groups.filter(
    (group) => !group.entireClass && group.name
  );
  if (splitGroups.length === 0) {
    return '';
  }

  let code = splitGroups[0]?.name ?? '';
  if (cohortShort && code.startsWith(cohortShort)) {
    code = code.slice(cohortShort.length).trim();
  }
  return code;
};
