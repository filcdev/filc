import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { sortCohorts } from '@/utils/cohort';
import { api, orpc } from '@/utils/orpc';

type TimetablesResponse = Awaited<
  ReturnType<typeof api.timetable.timetables.list>
>;

export type TimetableRow = TimetablesResponse[number];

type CohortsData = Awaited<
  ReturnType<typeof api.timetable.cohorts.getAllForTimetable>
>;

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** All timetables. */
export function useTimetables() {
  return useQuery(orpc.timetable.timetables.list.queryOptions());
}

/** Active timetable (when the user has no cohort) plus the cohort options. */
export function useCohortSelector(userCohortId: string | null) {
  const activeTimetableQuery = useQuery({
    ...orpc.timetable.timetables.latestValid.queryOptions(),
    enabled: !userCohortId,
  });

  const timetableId = userCohortId ?? activeTimetableQuery.data?.id ?? null;

  const cohortQuery = useQuery({
    enabled: !!timetableId,
    queryFn: async (): Promise<CohortsData> => {
      if (!timetableId) {
        throw new Error('Failed to load cohorts');
      }
      return sortCohorts(
        userCohortId
          ? await api.cohort.cohort()
          : await api.timetable.cohorts.getAllForTimetable({ timetableId })
      );
    },
    // One key for either branch: the payload is a cohort list, scoped to the
    // timetable the selector is showing.
    queryKey: [...orpc.cohort.cohort.key(), timetableId],
  });

  return { activeTimetableQuery, cohortQuery };
}

/** Preview of what deleting a timetable would remove. */
export function useDeletePreview(timetableId: string | null | undefined) {
  return useQuery({
    ...orpc.timetable.timetables.previewDelete.queryOptions({
      input: { id: timetableId ?? '' },
    }),
    enabled: !!timetableId,
  });
}

/**
 * Everything a timetable write can move: the timetables themselves, the public
 * teacher list and the admin one, and every lesson view (all but the cohorts
 * live under the `timetable` family, so one sweep covers them).
 */
function useInvalidateTimetableGraph() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.timetable.key() });
    queryClient.invalidateQueries({ queryKey: orpc.cohort.cohort.key() });
  };
}

/** Update a timetable's name or validity window. */
export function useUpdateTimetable({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.timetables.update.mutationOptions({
      onError: () => {
        toast.error(t('timetable.updateError'));
      },
      onSuccess: () => {
        toast.success(t('timetable.updateSuccess'));
        queryClient.invalidateQueries({
          queryKey: orpc.timetable.timetables.list.key(),
        });
        onSaved?.();
      },
    })
  );
}

/** Delete a timetable and everything hanging off it. */
export function useDeleteTimetable({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateTimetableGraph();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.timetables.delete.mutationOptions({
      onError: () => {
        toast.error(t('timetable.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('timetable.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Remove cohorts left orphaned by earlier timetable deletions. */
export function useCleanupOrphanedCohorts() {
  const invalidate = useInvalidateTimetableGraph();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.timetables.cleanupOrphanedCohorts.mutationOptions({
      onError: () => {
        toast.error(t('timetable.cleanupOrphanedCohortsError'));
      },
      onSuccess: () => {
        toast.success(t('timetable.cleanupOrphanedCohortsSuccess'));
        invalidate();
      },
    })
  );
}

type ImportTimetablePayload = {
  file: File;
  name: string;
  validFrom: Date;
  validTo?: Date;
};

/** Format a Date as a local `YYYY-MM-DD` string for date-only DB columns. */
const toDateInput = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Import an aSc/Oman XML timetable export; replaces the whole timetable graph. */
export function useImportTimetable({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTimetableGraph();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ file, name, validFrom, validTo }: ImportTimetablePayload) =>
      api.timetable.import({
        file,
        name,
        validFrom: toDateInput(validFrom),
        ...(validTo && { validTo: toDateInput(validTo) }),
      }),
    onError: () => {
      toast.error(t('timetable.importError'));
    },
    onSuccess: () => {
      toast.success(t('timetable.importSuccess'));
      // An import replaces every timetable-derived query, so sweep broadly.
      queryClient.invalidateQueries({ queryKey: orpc.timetable.key() });
      invalidate();
      onSaved?.();
    },
  });
}
