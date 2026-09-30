import { isDefinedError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type api, orpc } from '@/utils/orpc';

type SubstitutionsResponse = Awaited<
  ReturnType<typeof api.timetable.substitutions.list>
>;

export type SubstitutionItem = SubstitutionsResponse[number];

export type Teacher = NonNullable<SubstitutionItem['teacher']>;

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Full substitution list. */
export function useSubstitutions() {
  return useQuery(orpc.timetable.substitutions.list.queryOptions());
}

/** Teacher list for substitution pickers; only fetched when enabled. */
export function useSubstitutionTeachers(enabled: boolean) {
  return useQuery({
    ...orpc.timetable.teachers.getAll.queryOptions(),
    enabled,
  });
}

function useInvalidateSubstitutions() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: orpc.timetable.substitutions.list.key(),
    });
}

/**
 * Create an automatic substitution from existing lessons. A CONFLICT here
 * means the substitute teacher is already booked in that period on that date,
 * so it gets a translated message; everything else falls back to the backend
 * message.
 */
export function useCreateSubstitution({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSubstitutions();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.substitutions.create.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === 'CONFLICT'
            ? t('substitution.conflictError')
            : error.message || t('substitution.createError')
        );
      },
      onSuccess: () => {
        toast.success(t('substitution.createSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Update an existing substitution by id. */
export function useUpdateSubstitution({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSubstitutions();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.substitutions.update.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === 'CONFLICT'
            ? t('substitution.conflictError')
            : error.message || t('substitution.updateError')
        );
      },
      onSuccess: () => {
        toast.success(t('substitution.updateSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Delete a substitution by id. */
export function useDeleteSubstitution({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSubstitutions();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.substitutions.delete.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === 'CONFLICT'
            ? t('substitution.conflictError')
            : error.message || t('substitution.deleteError')
        );
      },
      onSuccess: () => {
        toast.success(t('substitution.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Create a manual substitution that does not map to existing lessons. */
export function useCreateManualSubstitution({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateSubstitutions();
  const { t } = useTranslation();
  return useMutation(
    orpc.timetable.substitutions.manual.mutationOptions({
      onError: (error) => {
        toast.error(
          isDefinedError(error) && error.code === 'CONFLICT'
            ? t('substitution.conflictError')
            : error.message || t('substitution.createError')
        );
      },
      onSuccess: () => {
        toast.success(t('substitution.createSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}
