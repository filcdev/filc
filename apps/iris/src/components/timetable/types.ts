import type dayjs from 'dayjs';
import type { InferResponseType } from 'hono/client';
import type { api } from '@/utils/hc';

export type FilterType = 'class' | 'teacher' | 'classroom';

export type SelectionsType = {
  class: string | null;
  teacher: string | null;
  classroom: string | null;
};

export type CohortResponse = InferResponseType<
  (typeof api.cohort.index)['$get']
>;
export type CohortItem = NonNullable<CohortResponse['data']>[number];

export type TeacherResponse = InferResponseType<
  (typeof api.timetable.teachers.getAll)['$get']
>;
export type TeacherItem = NonNullable<TeacherResponse['data']>[number];

export type ClassroomResponse = InferResponseType<
  (typeof api.timetable.classrooms.getAll)['$get']
>;
export type ClassroomItem = NonNullable<ClassroomResponse['data']>[number];

export type LessonsResponse = InferResponseType<
  (typeof api.timetable.lessons.getForCohort)[':cohortId']['$get']
>;
export type LessonItem = NonNullable<LessonsResponse['data']>[number];

export type DayColumn = {
  name: string;
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
  grid: Map<string, GridCell>; // key: `${dayName}-${HH:mm formatted startTime}`
};
