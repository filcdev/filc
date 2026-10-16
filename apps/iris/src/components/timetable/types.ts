import type dayjs from 'dayjs';
import type { api } from '@/utils/orpc';

export type FilterType = 'class' | 'teacher' | 'classroom';

export type SelectionsType = {
  class: string | null;
  teacher: string | null;
  classroom: string | null;
};

export type CohortItem = Awaited<
  ReturnType<typeof api.cohort.cohort>
>['items'][number];

export type TimetableItem = Awaited<
  ReturnType<typeof api.timetable.timetables.list>
>['items'][number];

export type TeacherItem = Awaited<
  ReturnType<typeof api.timetable.teachers.getAll>
>['items'][number];

export type ClassroomItem = Awaited<
  ReturnType<typeof api.timetable.classrooms.getAll>
>['items'][number];

export type LessonItem = Awaited<
  ReturnType<typeof api.timetable.lessons.getForCohort>
>['items'][number];

export type PeriodItem = Awaited<
  ReturnType<typeof api.timetable.periods.getAll>
>['items'][number];

export type DayColumn = {
  key: string;
  label: string;
  sortOrder: number;
};

export type TimeSlot = {
  index: number;
  start: dayjs.Dayjs;
  end: dayjs.Dayjs;
};

export type GridCell = {
  lessons: LessonItem[];
};

export type TimetableViewModel = {
  days: DayColumn[];
  timeSlots: TimeSlot[];
  grid: Map<string, GridCell>; // key: `${dayKey}-${HH:mm formatted startTime}`
};
