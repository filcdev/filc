import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type InferResponseType, parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type TimetablesResponse = InferResponseType<
  typeof api.timetable.timetables.$get
>;

export type TimetableRow = NonNullable<
  Extract<TimetablesResponse, { success: true }>['data']
>[number];

type UpdateTimetablePayload = {
  name?: string;
  validFrom?: string;
  validTo?: string | null;
};

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** All timetables. */
export function useTimetables() {
  return useQuery({
    queryFn: async (): Promise<TimetableRow[]> => {
      const res = await parseResponse(api.timetable.timetables.$get());
      if (!res.success) {
        throw new Error('Failed to load timetables');
      }
      return (res.data ?? []) as TimetableRow[];
    },
    queryKey: queryKeys.timetables.all(),
  });
}

/** Preview of what deleting a timetable would remove. */
export function useDeletePreview(timetableId: string | null | undefined) {
  return useQuery({
    enabled: !!timetableId,
    queryFn: async () => {
      if (!timetableId) {
        return null;
      }
      const res = await parseResponse(
        api.timetable.timetables[':id']['preview-delete'].$get({
          param: { id: timetableId },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load preview');
      }
      return res.data;
    },
    queryKey: ['timetables', 'preview-delete', timetableId] as const,
  });
}

function useInvalidateTimetableGraph() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.timetables.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
    queryClient.invalidateQueries({ queryKey: queryKeys.lessons() });
  };
}

/** Update a timetable's name or validity window. */
export function useUpdateTimetable({ onSaved }: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateTimetablePayload;
    }) => {
      const res = await parseResponse(
        api.timetable.timetables[':id'].$patch({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update timetable');
      }
      return res;
    },
    onError: () => {
      toast.error(t('timetable.updateError'));
    },
    onSuccess: () => {
      toast.success(t('timetable.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.timetables.all() });
      onSaved?.();
    },
  });
}

/** Delete a timetable and everything hanging off it. */
export function useDeleteTimetable({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateTimetableGraph();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.timetable.timetables[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete timetable');
      }
      return res;
    },
    onError: () => {
      toast.error(t('timetable.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('timetable.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Remove cohorts left orphaned by earlier timetable deletions. */
export function useCleanupOrphanedCohorts() {
  const invalidate = useInvalidateTimetableGraph();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async () => {
      const res = await parseResponse(
        api.timetable.timetables['cleanup-orphaned-cohorts'].$post()
      );
      if (!res.success) {
        throw new Error('Failed to clean up orphaned cohorts');
      }
      return res;
    },
    onError: () => {
      toast.error(t('timetable.cleanupOrphanedCohortsError'));
    },
    onSuccess: () => {
      toast.success(t('timetable.cleanupOrphanedCohortsSuccess'));
      invalidate();
    },
  });
}
