import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { SubstitutionItem } from '@/hooks/substitutions';
import { sortCohorts } from '@/utils/cohort';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type MovedLessonsResponse = InferResponseType<
  typeof api.timetable.movedLessons.$get
>;

export type MovedLessonItem = NonNullable<MovedLessonsResponse['data']>[number];

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

type CohortApiResponse = InferResponseType<typeof api.cohort.index.$get>;
export type Cohort = NonNullable<CohortApiResponse['data']>[number];

type SubjectsApiResponse = InferResponseType<
  typeof api.timetable.subjects.$get
>;
export type Subject = NonNullable<SubjectsApiResponse['data']>[number];

type TeachersApiResponse = InferResponseType<
  typeof api.timetable.teachers.getAll.$get
>;
export type Teacher = NonNullable<TeachersApiResponse['data']>[number];

type CreatePayload = InferRequestType<
  typeof api.timetable.movedLessons.$post
>['json'];

const updateMovedLessonEndpoint = api.timetable.movedLessons[':id'].$put;
type UpdatePayload = InferRequestType<typeof updateMovedLessonEndpoint>['json'];

type ManualPayload = InferRequestType<
  typeof api.timetable.movedLessons.manual.$post
>['json'];

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Full moved-lesson list. */
export function useMovedLessons() {
  return useQuery({
    queryFn: async (): Promise<MovedLessonItem[]> => {
      const res = await parseResponse(api.timetable.movedLessons.$get());
      if (!res.success) {
        throw new Error('Failed to load moved lessons');
      }
      return res.data as MovedLessonItem[];
    },
    queryKey: queryKeys.movedLessons(),
  });
}

/** Classroom list for moved-lesson pickers; only fetched when enabled. */
export function useMovedLessonClassrooms(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<Classroom[]> => {
      const res = await parseResponse(api.timetable.classrooms.getAll.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load classrooms');
      }
      return res.data as Classroom[];
    },
    queryKey: queryKeys.classrooms(),
  });
}

/** Cohort list for the moved-lesson picker; only fetched when enabled. */
export function useMovedLessonCohorts(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<Cohort[]> => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return sortCohorts(res.data) as Cohort[];
    },
    queryKey: queryKeys.cohorts(),
  });
}

/** Subject list for the manual move picker; only fetched when enabled. */
export function useMovedLessonSubjects(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<Subject[]> => {
      const res = await parseResponse(api.timetable.subjects.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load subjects');
      }
      return res.data as Subject[];
    },
    queryKey: queryKeys.subjects(),
  });
}

/** Teacher list for the manual move picker; only fetched when enabled. */
export function useMovedLessonTeachers(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<Teacher[]> => {
      const res = await parseResponse(api.timetable.teachers.getAll.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load teachers');
      }
      return res.data as Teacher[];
    },
    queryKey: queryKeys.teachers(),
  });
}

/** Substitutions feeding the enriched lesson picker; only fetched when enabled. */
export function useMovedLessonSubstitutions(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<SubstitutionItem[]> => {
      const res = await parseResponse(api.timetable.substitutions.$get());
      if (!res.success) {
        throw new Error('Failed to load substitutions');
      }
      return res.data as SubstitutionItem[];
    },
    queryKey: queryKeys.substitutions(),
  });
}

/** Lessons for every given cohort; only fetched when enabled and cohorts exist. */
export function useCohortLessonsForCohorts(
  cohorts: Cohort[],
  enabled: boolean
) {
  return useQuery({
    enabled: enabled && cohorts.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        cohorts.map(async (cohort) => {
          const res = await parseResponse(
            api.timetable.lessons.getForCohort[':cohortId'].$get({
              param: { cohortId: cohort.id },
              query: {},
            })
          );
          if (!res.success) {
            return { lessons: [] };
          }
          return { lessons: (res.data ?? []) as unknown as EnrichedLesson[] };
        })
      );
      return results;
    },
    queryKey: queryKeys.timetable.cohortLessons(cohorts),
  });
}

function useInvalidateMovedLessons() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.movedLessons() });
}

/** Create a moved lesson. */
export function useCreateMovedLesson({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateMovedLessons();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const res = await parseResponse(
        api.timetable.movedLessons.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create moved lesson');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('movedLesson.createError'));
    },
    onSuccess: () => {
      toast.success(t('movedLesson.createSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Create a moved lesson manually from explicit source/target fields. */
export function useCreateManualMovedLesson({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateMovedLessons();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: ManualPayload) => {
      const res = await parseResponse(
        api.timetable.movedLessons.manual.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create moved lesson');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('movedLesson.createError'));
    },
    onSuccess: () => {
      toast.success(t('movedLesson.createSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Update an existing moved lesson by id. */
export function useUpdateMovedLesson({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateMovedLessons();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdatePayload;
    }) => {
      const res = await parseResponse(
        api.timetable.movedLessons[':id'].$put({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update moved lesson');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('movedLesson.updateError'));
    },
    onSuccess: () => {
      toast.success(t('movedLesson.updateSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a moved lesson by id. */
export function useDeleteMovedLesson({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateMovedLessons();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.timetable.movedLessons[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete moved lesson');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('movedLesson.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('movedLesson.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}
