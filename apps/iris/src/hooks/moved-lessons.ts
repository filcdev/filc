import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { SubstitutionItem } from '@/hooks/substitutions';
import { sortCohorts } from '@/utils/cohort';
import { api, orpc } from '@/utils/orpc';

type MovedLessonsResponse = Awaited<
  ReturnType<typeof api.timetable.movedLessons.list>
>;

export type MovedLessonItem = MovedLessonsResponse[number];

export type Classroom = Omit<
  NonNullable<MovedLessonItem['classroom']>,
  'createdAt' | 'updatedAt'
>;

export type Period = Omit<
  NonNullable<MovedLessonItem['period']>,
  'createdAt' | 'updatedAt'
>;

export type DayDefinition = Omit<
  NonNullable<MovedLessonItem['dayDefinition']>,
  'createdAt' | 'updatedAt'
>;

export type EnrichedLesson = NonNullable<SubstitutionItem['lessons'][number]>;

type CohortApiResponse = Awaited<ReturnType<typeof api.cohort.cohort>>;
export type Cohort = CohortApiResponse[number];

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Full moved-lesson list. */
export function useMovedLessons() {
  return useQuery(orpc.timetable.movedLessons.list.queryOptions());
}

/** Classroom list for moved-lesson pickers; only fetched when enabled. */
export function useMovedLessonClassrooms(enabled: boolean) {
  return useQuery({
    ...orpc.timetable.classrooms.getAll.queryOptions(),
    enabled,
  });
}

/** Cohort list for the moved-lesson picker; only fetched when enabled. */
export function useMovedLessonCohorts(enabled: boolean) {
  return useQuery({
    ...orpc.cohort.cohort.queryOptions(),
    enabled,
    select: sortCohorts,
  });
}

/** Substitutions feeding the enriched lesson picker; only fetched when enabled. */
export function useMovedLessonSubstitutions(enabled: boolean) {
  return useQuery({
    ...orpc.timetable.substitutions.list.queryOptions(),
    enabled,
  });
}

/** Lessons for every given cohort; only fetched when enabled and cohorts exist. */
export function useCohortLessonsForCohorts(
  cohorts: Cohort[],
  enabled: boolean
) {
  return useQuery({
    enabled: enabled && cohorts.length > 0,
    queryFn: async () =>
      Promise.all(
        cohorts.map(async (cohort) => ({
          lessons: (await api.timetable.lessons.getForCohort({
            cohortId: cohort.id,
          })) as unknown as EnrichedLesson[],
        }))
      ),
    queryKey: orpc.timetable.lessons.key({
      input: { cohortIds: cohorts.map((cohort) => cohort.id) },
    }),
  });
}

function useInvalidateMovedLessons() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.timetable.movedLessons.list.key(),
    });
}

/** Create a moved lesson. */
export function useCreateMovedLesson({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateMovedLessons();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.movedLessons.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('movedLesson.createError'));
      },
      onSuccess: () => {
        toast.success(t('movedLesson.createSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Update an existing moved lesson by id. */
export function useUpdateMovedLesson({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateMovedLessons();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.movedLessons.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('movedLesson.updateError'));
      },
      onSuccess: () => {
        toast.success(t('movedLesson.updateSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Delete a moved lesson by id. */
export function useDeleteMovedLesson({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateMovedLessons();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.movedLessons.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('movedLesson.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('movedLesson.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}
