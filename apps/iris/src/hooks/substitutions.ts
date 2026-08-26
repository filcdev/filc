import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type SubstitutionsResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;

export type SubstitutionItem = NonNullable<
  SubstitutionsResponse['data']
>[number];

export type Teacher = NonNullable<SubstitutionItem['teacher']>;

type CreatePayload = InferRequestType<
  typeof api.timetable.substitutions.$post
>['json'];

type ManualPayload = InferRequestType<
  typeof api.timetable.substitutions.manual.$post
>['json'];

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Full substitution list. */
export function useSubstitutions() {
  return useQuery({
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

/** Teacher list for substitution pickers; only fetched when enabled. */
export function useSubstitutionTeachers(enabled: boolean) {
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

function useInvalidateSubstitutions() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.substitutions() });
}

/** Create an automatic substitution from existing lessons. */
export function useCreateSubstitution({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSubstitutions();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const res = await parseResponse(
        api.timetable.substitutions.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create substitution');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.createError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.createSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Update an existing substitution by id. */
export function useUpdateSubstitution({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSubstitutions();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: CreatePayload;
    }) => {
      const res = await parseResponse(
        api.timetable.substitutions[':id'].$put({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update substitution');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.updateError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.updateSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a substitution by id. */
export function useDeleteSubstitution({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSubstitutions();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.timetable.substitutions[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete substitution');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Create a manual substitution that does not map to existing lessons. */
export function useCreateManualSubstitution({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateSubstitutions();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: ManualPayload) => {
      const res = await parseResponse(
        api.timetable.substitutions.manual.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create manual substitution');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.createError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.createSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}
