import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type {
  DayColumn,
  FilterType,
  LessonItem,
  TimetableViewModel,
} from './types';

dayjs.extend(customParseFormat);

/** Format time string to HH:MM */
export const toHHMM = (t: string | undefined | null): string =>
  (t ?? '00:00:00').slice(0, 5);

/** Color palette for subject-based coloring */
const ACCENT_COLORS = [
  { bg: 'bg-blue-50/50 dark:bg-blue-900/20', border: 'border-blue-500/50' },
  {
    bg: 'bg-emerald-50/50 dark:bg-emerald-900/20',
    border: 'border-emerald-500/50',
  },
  { bg: 'bg-amber-50/50 dark:bg-amber-900/20', border: 'border-amber-500/50' },
  {
    bg: 'bg-purple-50/50 dark:bg-purple-900/20',
    border: 'border-purple-500/50',
  },
  { bg: 'bg-rose-50/50 dark:bg-rose-900/20', border: 'border-rose-500/50' },
  { bg: 'bg-cyan-50/50 dark:bg-cyan-900/20', border: 'border-cyan-500/50' },
] as const;

/** Get consistent color classes for a subject */
export const getSubjectColor = (
  name: string
): { bg: string; border: string } => {
  let sum = 0;
  for (const ch of name) {
    sum += ch.codePointAt(0) ?? 0;
  }
  return (
    ACCENT_COLORS[Math.abs(sum) % ACCENT_COLORS.length] ?? {
      bg: '',
      border: '',
    }
  );
};

/** Format teacher display name */
const formatTeacher = (teacher: LessonItem['teachers'][number]): string => {
  if (!teacher) {
    return '';
  }
  if ('short' in teacher && teacher.short) {
    return teacher.short;
  }
  if ('name' in teacher && teacher.name) {
    return teacher.name;
  }
  const first = (teacher as Record<string, string>).firstName ?? '';
  const last = (teacher as Record<string, string>).lastName ?? '';
  return `${first} ${last}`.trim();
};

/** Format teachers list */
export const formatTeachers = (teachers: LessonItem['teachers']): string =>
  (teachers ?? []).map(formatTeacher).filter(Boolean).join(', ');

/** Format room display */
const formatRoom = (room: LessonItem['classrooms'][number]): string => {
  if (!room) {
    return '';
  }
  return room.short ?? room.name ?? '';
};

/** Format rooms list */
export const formatRooms = (rooms: LessonItem['classrooms']): string =>
  (rooms ?? []).map(formatRoom).filter(Boolean).join(', ');

/** Process a single lesson into the grid structure */
const processLesson = (
  lesson: LessonItem,
  dayMap: Map<string, number>,
  timeMap: Map<string, { start: dayjs.Dayjs; end: dayjs.Dayjs }>,
  grid: Map<string, { lessons: LessonItem[] }>
) => {
  const dayName = lesson.day?.name ?? '';
  const dayOrder = lesson.day?.days?.[0]
    ? Number.parseInt(lesson.day.days[0], 10)
    : 999;

  // Track day with lowest sort order
  if (!dayMap.has(dayName) || (dayMap.get(dayName) ?? 999) > dayOrder) {
    dayMap.set(dayName, dayOrder);
  }

  // Parse start and end times from lesson period
  const startTimeStr = toHHMM(lesson.period?.startTime);
  const endTimeStr = toHHMM(lesson.period?.endTime);

  const start = dayjs(startTimeStr, 'HH:mm');
  const end =
    endTimeStr && endTimeStr !== '00:00'
      ? dayjs(endTimeStr, 'HH:mm')
      : start.add(45, 'minute');

  // Store time slot with actual end time
  const existing = timeMap.get(startTimeStr);
  if (!existing || end.isAfter(existing.end)) {
    timeMap.set(startTimeStr, { end, start });
  }

  // Group lessons by day-time cell
  const key = `${dayName}-${startTimeStr}`;
  const cell = grid.get(key) ?? { lessons: [] };
  cell.lessons.push(lesson);
  grid.set(key, cell);
};

/** Build view model from lessons array */
export const buildViewModel = (lessons: LessonItem[]): TimetableViewModel => {
  if (!lessons.length) {
    return { days: [], grid: new Map(), timeSlots: [] };
  }

  // Collect unique days and time slots
  const dayMap = new Map<string, number>();
  const timeMap = new Map<string, { start: dayjs.Dayjs; end: dayjs.Dayjs }>();
  const grid = new Map<string, { lessons: LessonItem[] }>();

  // Process each lesson
  for (const lesson of lessons) {
    processLesson(lesson, dayMap, timeMap, grid);
  }

  // Build sorted arrays
  const days: DayColumn[] = Array.from(dayMap.entries())
    .map(([name, sortOrder]) => ({ name, sortOrder }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const timeSlots = Array.from(timeMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, times], index) => ({
      end: times.end,
      index: index + 1,
      start: times.start,
    }));

  return { days, grid, timeSlots };
};

/** Get filter label for i18n */
export const filterLabelFor = (
  activeFilter: FilterType,
  t: (key: string) => string
): string => {
  const labels: Record<FilterType, string> = {
    class: 'timetable.filterByClass',
    classroom: 'timetable.filterByClassroom',
    teacher: 'timetable.filterByTeacher',
  };
  return t(labels[activeFilter]);
};
