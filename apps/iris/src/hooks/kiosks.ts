import type { KioskKind } from '@filcdev/api/domains/kiosk/config';
import type {
  CreateKioskInput,
  UpdateKioskInput,
} from '@filcdev/api/domains/kiosk/crud';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

/** Options accepted by every mutation hook: react to a successful save. */
export type KioskMutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** One managed kiosk box as stored by Chronos. */
export type KioskRow = {
  appVersion: string | null;
  config: unknown;
  createdAt: string;
  enabled: boolean;
  id: string;
  kind: KioskKind;
  lastSeenAt: string | null;
  lastSeenIp: string | null;
  machineId: string;
  name: string;
  updatedAt: string;
};

/** Every enrolled kiosk, ordered by name; only fetched when enabled. */
export function useKiosks(enabled = true) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<KioskRow[]> => {
      const res = await parseResponse(api.kiosk.index.$get());
      if (!res.success) {
        throw new Error('Failed to load kiosks');
      }
      return res.data.kiosks as KioskRow[];
    },
    queryKey: queryKeys.kiosks(),
  });
}

function useInvalidateKiosks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.kiosks() });
}

/** Enrol a box; a duplicate machine id is rejected with a conflict. */
export function useCreateKiosk({ onSaved }: KioskMutationCallbacks = {}) {
  const invalidate = useInvalidateKiosks();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: CreateKioskInput) => {
      const res = await parseResponse(api.kiosk.index.$post({ json: payload }));
      if (!res.success) {
        throw new Error('Failed to create kiosk');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('kiosk.createError'));
    },
    onSuccess: () => {
      toast.success(t('kiosk.createSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Update a kiosk's name, kind, enabled flag or config. */
export function useUpdateKiosk({ onSaved }: KioskMutationCallbacks = {}) {
  const invalidate = useInvalidateKiosks();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateKioskInput;
    }) => {
      const res = await parseResponse(
        api.kiosk[':id'].$put({ json: payload, param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to update kiosk');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('kiosk.updateError'));
    },
    onSuccess: () => {
      toast.success(t('kiosk.updateSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Remove a kiosk row. */
export function useDeleteKiosk({ onSaved }: KioskMutationCallbacks = {}) {
  const invalidate = useInvalidateKiosks();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.kiosk[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete kiosk');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('kiosk.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('kiosk.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}
