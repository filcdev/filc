import { useQuery } from '@tanstack/react-query';
import { sortCohorts } from '@/utils/cohort';
import { api, orpc } from '@/utils/orpc';

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

type TimetablesResponse = Awaited<
  ReturnType<typeof api.timetable.timetables.list>
>;

/** A single entry of the public timetables list. */
export type PublicTimetable = TimetablesResponse[number];

type CohortsForTimetableResponse = Awaited<
  ReturnType<typeof api.timetable.cohorts.getAllForTimetable>
>;

/** A cohort scoped to one timetable. */
export type PublicCohort = CohortsForTimetableResponse[number];

type TeachersResponse = Awaited<
  ReturnType<typeof api.timetable.teachers.getAll>
>;

/** A teacher from the public teacher list. */
export type PublicTeacher = TeachersResponse[number];

type ClassroomsResponse = Awaited<
  ReturnType<typeof api.timetable.classrooms.getAll>
>;

/** A classroom from the public classroom list. */
export type PublicClassroom = ClassroomsResponse[number];

type PeriodsResponse = Awaited<ReturnType<typeof api.timetable.periods.getAll>>;

/** A period of the daily schedule for one timetable. */
export type PublicPeriod = PeriodsResponse[number];

type LessonsResponse = Awaited<
  ReturnType<typeof api.timetable.lessons.getForCohort>
>;

/** A lesson of a cohort/teacher/room timetable view. */
export type PublicLesson = LessonsResponse[number];

/** Per-user notification settings, including timetable class colors. */
export type TimetableUserSettings = Awaited<
  ReturnType<typeof api.notifications.settings>
>;

/** All timetables; shared by the public timetable and substitutions pages. */
export function useTimetables() {
  return useQuery({
    ...orpc.timetable.timetables.list.queryOptions(),
    ...QUERY_OPTIONS,
  });
}

/** The latest valid timetable, or `null` when none exists yet. */
export function useLatestValidTimetable() {
  return useQuery({
    ...orpc.timetable.timetables.latestValid.queryOptions(),
    ...QUERY_OPTIONS,
    // A school without a valid timetable is answered with a null body; the
    // public pages branch on it.
    select: (payload) => (payload ?? null) as PublicTimetable | null,
  });
}

/** Cohorts of one timetable; only fetched when the timetable id is known. */
export function useTimetableCohorts(timetableId: string | null | undefined) {
  return useQuery({
    ...orpc.timetable.cohorts.getAllForTimetable.queryOptions({
      // Only ever fetched when the id is known; the empty string keeps the
      // input well-formed while the query is disabled.
      input: { timetableId: timetableId ?? '' },
    }),
    ...QUERY_OPTIONS,
    enabled: !!timetableId,
    select: sortCohorts,
  });
}

/** Teacher list for the public filter bars. */
export function useTeachers() {
  return useQuery({
    ...orpc.timetable.teachers.getAll.queryOptions(),
    ...QUERY_OPTIONS,
  });
}

type MyTeacherResponse = Awaited<ReturnType<typeof api.timetable.teachers.me>>;

/** The signed-in user's linked teacher, or `null` when unlinked. */
export type MyTeacher = NonNullable<MyTeacherResponse>;

/**
 * The signed-in user's linked teacher. Unlike the immutable reference data
 * above, this can change mid-session (an import or admin relink may land after
 * the first fetch), so it uses a finite `staleTime` and refetches on mount
 * instead of pinning a transient `null` for the whole session. Scoped to the
 * user so a different account's cached result is never reused.
 */
export function useMyTeacher(
  enabled: boolean,
  userId: string | null | undefined
) {
  return useQuery({
    ...orpc.timetable.teachers.me.queryOptions(),
    enabled,
    queryKey: [...orpc.timetable.teachers.me.key(), userId ?? ''],
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/** Classroom list for the public filter bars. */
export function useClassrooms() {
  return useQuery({
    ...orpc.timetable.classrooms.getAll.queryOptions(),
    ...QUERY_OPTIONS,
  });
}

/** Periods of one timetable; only fetched when the timetable id is known. */
export function useTimetablePeriods(timetableId: string | null | undefined) {
  return useQuery({
    ...orpc.timetable.periods.getAll.queryOptions({
      // Only ever fetched when the id is known; the empty string keeps the
      // input well-formed while the query is disabled.
      input: { timetableId: timetableId ?? '' },
    }),
    ...QUERY_OPTIONS,
    enabled: !!timetableId,
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
      const timetable = timetableId ? { timetableId } : {};
      if (filter === 'class') {
        return await api.timetable.lessons.getForCohort({
          cohortId: selection,
          ...timetable,
        });
      }
      if (filter === 'classroom') {
        return await api.timetable.lessons.getForRoom({
          classroomId: selection,
          ...timetable,
        });
      }
      return await api.timetable.lessons.getForTeacher({
        teacherId: selection,
        ...timetable,
      });
    },
    // One key per view: which of the three lesson endpoints answered is part
    // of the selection, and every one of them is invalidated by the family key.
    queryKey: orpc.timetable.lessons.key({
      input: { filter, selectionId, timetableId },
    }),
  });
}

/** Full substitution list for the public page; only fetched when enabled. */
export function usePublicSubstitutions(enabled: boolean) {
  return useQuery({
    ...orpc.timetable.substitutions.list.queryOptions(),
    enabled,
  });
}

/** Moved-lesson list for the public page; only fetched when enabled. */
export function usePublicMovedLessons(enabled: boolean) {
  return useQuery({
    ...orpc.timetable.movedLessons.list.queryOptions(),
    enabled,
  });
}

/**
 * Per-user notification settings (timetable class colors); only fetched when
 * enabled, e.g. for authenticated visitors.
 */
export function useTimetableUserSettings(enabled: boolean) {
  return useQuery({
    ...orpc.notifications.settings.queryOptions(),
    enabled,
  });
}
