import type { KioskKind } from '@filcdev/api/domains/kiosk/config';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type api, orpc } from '@/utils/orpc';

/** Options accepted by every mutation hook: react to a successful save. */
export type KioskMutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

type KioskListRow = Awaited<
  ReturnType<typeof api.kiosk.list>
>['kiosks'][number];

/** One managed kiosk box as stored by Chronos. */
export type KioskRow = Omit<KioskListRow, 'kind'> & { kind: KioskKind };

/** Every enrolled kiosk, ordered by name; only fetched when enabled. */
export function useKiosks(enabled = true) {
  return useQuery({
    ...orpc.kiosk.list.queryOptions(),
    enabled,
    // `kind` is a plain text column validated when written, so its values are
    // always the enum the pickers expect.
    select: (payload) => payload.kiosks as KioskRow[],
  });
}

/** Enrol a box; a duplicate machine id is rejected with a conflict. */
export function useCreateKiosk({ onSaved }: KioskMutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.kiosk.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('kiosk.createError'));
      },
      onSuccess: () => {
        toast.success(t('kiosk.createSuccess'));
        queryClient.invalidateQueries({ queryKey: orpc.kiosk.list.key() });
        onSaved?.();
      },
    })
  );
}

/** Update a kiosk's name, kind, enabled flag or config. */
export function useUpdateKiosk({ onSaved }: KioskMutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.kiosk.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('kiosk.updateError'));
      },
      onSuccess: () => {
        toast.success(t('kiosk.updateSuccess'));
        queryClient.invalidateQueries({ queryKey: orpc.kiosk.list.key() });
        onSaved?.();
      },
    })
  );
}

/** Remove a kiosk row. */
export function useDeleteKiosk({ onSaved }: KioskMutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.kiosk.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('kiosk.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('kiosk.deleteSuccess'));
        queryClient.invalidateQueries({ queryKey: orpc.kiosk.list.key() });
        onSaved?.();
      },
    })
  );
}
