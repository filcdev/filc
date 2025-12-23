import type {
  CellBlock,
  DayColumn,
  FilterType,
  LessonItem,
  ViewModel,
} from './types';

const TIME_FORMAT_SLICE = 5;
export const toHHMM = (t: string | undefined | null) =>
  (t ?? '00:00:00').slice(0, TIME_FORMAT_SLICE);

const COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#3b82f6',
] as const;

export const colorFromSubject = (name: string) => {
  let sum = 0;
  for (const ch of name) {
    sum += ch.codePointAt(0) ?? 0;
  }
  const idx = Math.abs(sum) % COLORS.length;
  return COLORS[idx] ?? COLORS[0];
};

const teacherKey = (teacher: LessonItem['teachers'][number]) => {
  if (!teacher) {
    return '';
  }
  if ('id' in teacher && teacher.id) {
    return teacher.id;
  }
  if ('short' in teacher && teacher.short) {
    return teacher.short;
  }
  if ('name' in teacher && teacher.name) {
    return teacher.name;
  }
  const first = (teacher as Record<string, string | undefined>).firstName ?? '';
  const last = (teacher as Record<string, string | undefined>).lastName ?? '';
  return `${first} ${last}`.trim();
};

const roomKey = (room: LessonItem['classrooms'][number]) => {
  if (!room) {
    return '';
  }
  if ('id' in room && room.id) {
    return room.id;
  }
  return room.short ?? room.name ?? '';
};

const subjectKey = (lesson: LessonItem) =>
  lesson.subject?.id ??
  lesson.subject?.short ??
  lesson.subject?.name ??
  'subject';

const lessonSignature = (lesson: LessonItem) => {
  const subject = subjectKey(lesson);
  const teachers = (lesson.teachers ?? [])
    .map((t) => teacherKey(t))
    .filter(Boolean)
    .sort()
    .join(',');
  const rooms = (lesson.classrooms ?? [])
    .map((r) => roomKey(r))
    .filter(Boolean)
    .sort()
    .join(',');

  return `${subject}|t:${teachers}|r:${rooms}`;
};

const buildCellKey = (lessons: LessonItem[]) =>
  lessons
    .map((lesson) => lessonSignature(lesson))
    .filter(Boolean)
    .sort()
    .join('||');

const getLatestEnd = (fallback: string, lessons: LessonItem[]) => {
  let latest = fallback;
  for (const lesson of lessons) {
    const candidate = toHHMM(lesson.period?.endTime);
    if (candidate > latest) {
      latest = candidate;
    }
  }
  return latest;
};

const teacherDisplay = (teacher: LessonItem['teachers'][number]) => {
  if (!teacher) {
    return '';
  }
  if ('name' in teacher && teacher.name) {
    return teacher.name;
  }
  if ('firstName' in teacher || 'lastName' in teacher) {
    const first =
      (teacher as Record<string, string | undefined>).firstName ?? '';
    const last = (teacher as Record<string, string | undefined>).lastName ?? '';
    return `${first} ${last}`.trim();
  }
  return '';
};

const teacherShortDisplay = (teacher: LessonItem['teachers'][number]) => {
  if (!teacher) {
    return '';
  }
  if ('short' in teacher && teacher.short) {
    return teacher.short;
  }
  if ('name' in teacher && teacher.name) {
    return teacher.name;
  }
  return teacherDisplay(teacher);
};

const roomDisplay = (room: LessonItem['classrooms'][number]) => {
  if (!room) {
    return '';
  }
  return room.short ?? room.name ?? '';
};

export const formatTeachers = (teachers: LessonItem['teachers']) =>
  (teachers ?? [])
    .map((t) => teacherDisplay(t))
    .filter(Boolean)
    .join(', ');

export const formatTeachersShort = (teachers: LessonItem['teachers']) =>
  (teachers ?? [])
    .map((t) => teacherShortDisplay(t))
    .filter(Boolean)
    .join(', ');

export const formatRooms = (rooms: LessonItem['classrooms']) =>
  (rooms ?? [])
    .map((r) => roomDisplay(r))
    .filter(Boolean)
    .join(', ');

export const formatRoomsShort = (rooms: LessonItem['classrooms']) =>
  (rooms ?? [])
    .map((r) => roomDisplay(r))
    .filter(Boolean)
    .join(', ');

const collectDayMetaAndSlots = (lessons: LessonItem[]) => {
  const dayMeta = new Map<string, number>();
  const timeSlotsSet = new Set<string>();
  const dayTime = new Map<string, Map<string, LessonItem[]>>();

  for (const lesson of lessons) {
    const dayName = lesson.day?.name ?? 'Unknown';
    const dayOrder = lesson.day?.days?.[0]
      ? Number.parseInt(lesson.day.days[0], 10)
      : 999;

    if (!dayMeta.has(dayName) || (dayMeta.get(dayName) ?? 999) > dayOrder) {
      dayMeta.set(dayName, dayOrder);
    }

    const start = toHHMM(lesson.period?.startTime);
    timeSlotsSet.add(start);

    const byTime = dayTime.get(dayName) ?? new Map<string, LessonItem[]>();
    const list = byTime.get(start) ?? [];
    list.push(lesson);
    byTime.set(start, list);
    dayTime.set(dayName, byTime);
  }

  return { dayMeta, dayTime, timeSlotsSet };
};

const buildGrid = (
  days: DayColumn[],
  timeSlots: string[],
  dayTime: Map<string, Map<string, LessonItem[]>>
): ViewModel['grid'] => {
  const grid: ViewModel['grid'] = timeSlots.reduce<
    Record<string, ViewModel['grid'][string]>
  >((acc, time) => {
    acc[time] = {};
    return acc;
  }, {});

  for (const day of days) {
    const byTime = dayTime.get(day.name) ?? new Map<string, LessonItem[]>();
    fillDayColumn(day, timeSlots, byTime, grid);
  }

  return grid;
};

const fillDayColumn = (
  day: DayColumn,
  timeSlots: string[],
  byTime: Map<string, LessonItem[]>,
  grid: ViewModel['grid']
) => {
  for (let i = 0; i < timeSlots.length; i += 1) {
    const time = timeSlots[i];
    if (!time) {
      continue;
    }

    const row = grid[time];
    if (!row || row[day.name]) {
      continue;
    }

    const lessonsAtStart = byTime.get(time) ?? [];
    if (!lessonsAtStart.length) {
      row[day.name] = { type: 'empty' };
      continue;
    }

    row[day.name] = {
      block: createCellBlock({
        byTime,
        dayName: day.name,
        grid,
        lessons: lessonsAtStart,
        startIndex: i,
        startTime: time,
        timeSlots,
      }),
      type: 'block',
    };
  }
};

type CreateCellBlockOptions = {
  dayName: string;
  startTime: string;
  lessons: LessonItem[];
  startIndex: number;
  timeSlots: string[];
  byTime: Map<string, LessonItem[]>;
  grid: ViewModel['grid'];
};

const createCellBlock = (options: CreateCellBlockOptions): CellBlock => {
  const { dayName, grid, lessons, startIndex, startTime, timeSlots, byTime } =
    options;

  const cellKey = buildCellKey(lessons);
  let rowSpan = 1;
  let endTime = getLatestEnd(startTime, lessons);
  if (endTime <= startTime) {
    endTime = timeSlots[startIndex + 1] ?? startTime;
  }

  for (
    let nextIndex = startIndex + 1;
    nextIndex < timeSlots.length;
    nextIndex += 1
  ) {
    const nextTime = timeSlots[nextIndex];
    if (!nextTime) {
      break;
    }

    const nextRow = grid[nextTime];
    if (!nextRow) {
      continue;
    }

    if (nextTime < endTime) {
      nextRow[dayName] = { type: 'skip' };
      rowSpan += 1;
      continue;
    }

    const nextLessons = byTime.get(nextTime) ?? [];
    if (!nextLessons.length) {
      break;
    }

    const nextKey = buildCellKey(nextLessons);
    if (nextKey !== cellKey) {
      break;
    }

    nextRow[dayName] = { type: 'skip' };
    rowSpan += 1;
    endTime = getLatestEnd(endTime, nextLessons);
  }

  return {
    endTime,
    key: `${dayName}-${cellKey}-${startTime}`,
    lessons,
    rowSpan,
    startTime,
  };
};

export const buildViewModel = (lessons: LessonItem[]): ViewModel => {
  if (!lessons.length) {
    return { days: [], grid: {}, timeSlots: [] };
  }

  const { dayMeta, dayTime, timeSlotsSet } = collectDayMetaAndSlots(lessons);

  const days = Array.from(dayMeta.entries())
    .map(([name, sortOrder]) => ({ name, sortOrder }))
    .sort((a, b) =>
      a.sortOrder === b.sortOrder
        ? a.name.localeCompare(b.name)
        : a.sortOrder - b.sortOrder
    );

  const timeSlots = Array.from(timeSlotsSet).sort();
  const grid = buildGrid(days, timeSlots, dayTime);

  return { days, grid, timeSlots };
};

export const getSelectedFromUrl = (
  cohorts: { id: string }[] | undefined,
  teachers: { id: string }[] | undefined,
  classrooms: { id: string }[] | undefined
): {
  cohortClass: string | null;
  cohortTeacher: string | null;
  cohortClassroom: string | null;
} => {
  try {
    const params = new URLSearchParams(window.location.search);

    const byClass = params.get('cohortClass');
    if (byClass && cohorts?.some((c) => c.id === byClass)) {
      return {
        cohortClass: byClass,
        cohortClassroom: null,
        cohortTeacher: null,
      };
    }

    const byTeacher = params.get('cohortTeacher');
    if (byTeacher && teachers?.some((t) => t.id === byTeacher)) {
      return {
        cohortClass: null,
        cohortClassroom: null,
        cohortTeacher: byTeacher,
      };
    }

    const byRoom = params.get('cohortClassroom');
    if (byRoom && classrooms?.some((c) => c.id === byRoom)) {
      return {
        cohortClass: null,
        cohortClassroom: byRoom,
        cohortTeacher: null,
      };
    }
  } catch {
    // ignore URL parsing issues
  }

  return { cohortClass: null, cohortClassroom: null, cohortTeacher: null };
};

export const filterLabelFor = (activeFilter: FilterType) => {
  if (activeFilter === 'class') {
    return 'Class';
  }
  if (activeFilter === 'teacher') {
    return 'Teacher';
  }
  return 'Classroom';
};
