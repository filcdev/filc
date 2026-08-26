import { useQuery } from '@tanstack/react-query';
import { type InferResponseType, parseResponse } from 'hono/client';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';
import type { MovedLessonItem } from './moved-lessons';
import type { SubstitutionItem } from './substitutions';

/**
 * Query options shared by the cacheable public lookups: the timetable pages
 * treat this reference data as immutable for the session.
 */
const QUERY_OPTIONS = {
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: Number.POSITIVE_INFINITY,
};

type TimetablesResponse = InferResponseType<
  typeof api.timetable.timetables.$get
>;

/** A single entry of the public timetables list. */
export type PublicTimetable = NonNullable<TimetablesResponse['data']>[number];

type CohortsForTimetableResponse = InferResponseType<
  (typeof api.timetable.cohorts.getAllForTimetable)[':timetableId']['$get']
>;

/** A cohort scoped to one timetable. */
export type PublicCohort = NonNullable<
  CohortsForTimetableResponse['data']
>[number];

type TeachersResponse = InferResponseType<
  typeof api.timetable.teachers.getAll.$get
>;

/** A teacher from the public teacher list. */
export type PublicTeacher = NonNullable<TeachersResponse['data']>[number];

type ClassroomsResponse = InferResponseType<
  typeof api.timetable.classrooms.getAll.$get
>;

/** A classroom from the public classroom list. */
export type PublicClassroom = NonNullable<ClassroomsResponse['data']>[number];

type PeriodsResponse = InferResponseType<
  typeof api.timetable.periods.getAll.$get
>;

/** A period of the daily schedule for one timetable. */
export type PublicPeriod = NonNullable<PeriodsResponse['data']>[number];

type LessonsResponse = InferResponseType<
  (typeof api.timetable.lessons.getForCohort)[':cohortId']['$get']
>;

/** A lesson of a cohort/teacher/room timetable view. */
export type PublicLesson = NonNullable<LessonsResponse['data']>[number];

type NotificationSettingsResponse = InferResponseType<
  typeof api.notifications.settings.$get
>;

/** Per-user notification settings, including timetable class colors. */
export type TimetableUserSettings = NonNullable<
  NotificationSettingsResponse['data']
>;

/** All timetables; shared by the public timetable and substitutions pages. */
export function useTimetables() {
  return useQuery({
    ...QUERY_OPTIONS,
    queryFn: async (): Promise<PublicTimetable[]> => {
      const res = await parseResponse(api.timetable.timetables.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load timetables');
      }
      return res.data as PublicTimetable[];
    },
    queryKey: queryKeys.timetables.all(),
  });
}

/** The latest valid timetable, or `null` when none exists yet. */
export function useLatestValidTimetable() {
  return useQuery({
    ...QUERY_OPTIONS,
    queryFn: async (): Promise<PublicTimetable | null> => {
      const res = await parseResponse(
        api.timetable.timetables.latestValid.$get()
      );
      if (!res.success) {
        throw new Error('Failed to load the latest valid timetable');
      }
      return (res.data as PublicTimetable | null) ?? null;
    },
    queryKey: queryKeys.timetables.latestValid(),
  });
}

/** Cohorts of one timetable; only fetched when the timetable id is known. */
export function useTimetableCohorts(timetableId: string | null | undefined) {
  return useQuery({
    ...QUERY_OPTIONS,
    enabled: !!timetableId,
    queryFn: async (): Promise<PublicCohort[]> => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const id = timetableId!;
      const res = await parseResponse(
        api.timetable.cohorts.getAllForTimetable[':timetableId'].$get({
          param: { timetableId: id },
        })
      );
      if (!(res.success && res.data)) {
        throw new Error('Failed to load cohorts');
      }
      return res.data as PublicCohort[];
    },
    queryKey: queryKeys.timetable.cohorts(timetableId),
  });
}

/** Teacher list for the public filter bars. */
export function useTeachers() {
  return useQuery({
    ...QUERY_OPTIONS,
    queryFn: async (): Promise<PublicTeacher[]> => {
      const res = await parseResponse(api.timetable.teachers.getAll.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load teachers');
      }
      return res.data as PublicTeacher[];
    },
    queryKey: queryKeys.teachers(),
  });
}

/** Classroom list for the public filter bars. */
export function useClassrooms() {
  return useQuery({
    ...QUERY_OPTIONS,
    queryFn: async (): Promise<PublicClassroom[]> => {
      const res = await parseResponse(api.timetable.classrooms.getAll.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load classrooms');
      }
      return res.data as PublicClassroom[];
    },
    queryKey: queryKeys.classrooms(),
  });
}

/** Periods of one timetable; only fetched when the timetable id is known. */
export function useTimetablePeriods(timetableId: string | null | undefined) {
  return useQuery({
    ...QUERY_OPTIONS,
    enabled: !!timetableId,
    queryFn: async (): Promise<PublicPeriod[]> => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const id = timetableId!;
      const res = await parseResponse(
        api.timetable.periods.getAll.$get({ query: { timetableId: id } })
      );
      if (!(res.success && res.data)) {
        throw new Error('Failed to load periods');
      }
      return res.data as PublicPeriod[];
    },
    queryKey: queryKeys.timetable.periods(timetableId),
  });
}

/** Lessons of the selected class, teacher, or room view. */
export function useTimetableLessons(
  filter: string | null,
  selectionId: string | null,
  timetableId: string | null
) {
  return useQuery({
    ...QUERY_OPTIONS,
    enabled: !!selectionId,
    queryFn: async (): Promise<PublicLesson[]> => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const selection = selectionId!;
      const query = timetableId ? { timetableId } : {};
      const load = async (): Promise<{
        data?: PublicLesson[];
        success: boolean;
      }> => {
        if (filter === 'class') {
          return await parseResponse(
            api.timetable.lessons.getForCohort[':cohortId'].$get({
              param: { cohortId: selection },
              query,
            })
          );
        }
        if (filter === 'classroom') {
          return await parseResponse(
            api.timetable.lessons.getForRoom[':classroomId'].$get({
              param: { classroomId: selection },
              query,
            })
          );
        }
        return await parseResponse(
          api.timetable.lessons.getForTeacher[':teacherId'].$get({
            param: { teacherId: selection },
            query,
          })
        );
      };
      const res = await load();
      if (!(res.success && res.data)) {
        throw new Error('Failed to load lessons');
      }
      return res.data as PublicLesson[];
    },
    queryKey: queryKeys.timetable.lessons(filter, selectionId, timetableId),
  });
}

/** Full substitution list for the public page; only fetched when enabled. */
export function usePublicSubstitutions(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<SubstitutionItem[]> => {
      const res = await parseResponse(api.timetable.substitutions.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load substitutions');
      }
      return res.data as SubstitutionItem[];
    },
    queryKey: queryKeys.substitutions(),
  });
}

/** Moved-lesson list for the public page; only fetched when enabled. */
export function usePublicMovedLessons(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<MovedLessonItem[]> => {
      const res = await parseResponse(api.timetable.movedLessons.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load moved lessons');
      }
      return res.data as MovedLessonItem[];
    },
    queryKey: queryKeys.movedLessons(),
  });
}

/**
 * Per-user notification settings (timetable class colors); only fetched when
 * enabled, e.g. for authenticated visitors.
 */
export function useTimetableUserSettings(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<TimetableUserSettings | null> => {
      const res = await parseResponse(api.notifications.settings.$get());
      if (!res.success) {
        throw new Error('Failed to load user settings');
      }
      return (res.data as TimetableUserSettings | null) ?? null;
    },
    queryKey: queryKeys.notifications.settings(),
  });
}
