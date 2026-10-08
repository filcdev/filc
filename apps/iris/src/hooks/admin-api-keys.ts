import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type api, orpc } from '@/utils/orpc';

/**
 * Admin view over *every* user's API keys.
 *
 * better-auth's own api-key endpoints are session-scoped — they only ever
 * answer for the caller's own keys — so this screen cannot be built on the
 * client plugin. It reads the `apikey` table through the admin-only
 * `adminApiKeys` procedures instead, which is also why deleting here can
 * revoke another user's key.
 */

/** Options accepted by every mutation hook: react to a successful save. */
export type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

type AdminApiKeyList = Awaited<ReturnType<typeof api.adminApiKeys.list>>;

/** One API key as the admin table renders it, joined with its owner. */
export type AdminApiKey = AdminApiKeyList['apiKeys'][number];

/** Page size shared by the admin API-keys page and its query. */
export const ADMIN_API_KEYS_PAGE_SIZE = 20;

/** Query parameters for the admin API-key list. */
export type AdminApiKeysInput = Parameters<typeof api.adminApiKeys.list>[0];

/** Update payload for the admin enable/disable toggle. */
export type AdminApiKeyUpdateInput = Parameters<
  typeof api.adminApiKeys.update
>[0];

/**
 * React Query options for one page of every user's API keys, exported so a
 * route loader can prefetch exactly what the hook reads.
 */
export function adminApiKeysQueryOptions(input: AdminApiKeysInput) {
  return orpc.adminApiKeys.list.queryOptions({ input });
}

/** Every user's API keys, newest first. */
export function useAdminApiKeys(input: AdminApiKeysInput) {
  return useQuery(adminApiKeysQueryOptions(input));
}

/** Kept in sync by every admin key write: the list is the only cached view. */
function useInvalidateAdminApiKeys() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.adminApiKeys.list.key() });
}

/** Enable or disable any user's key. */
export function useAdminUpdateApiKey({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateAdminApiKeys();
  const { t } = useTranslation();
  return useMutation(
    orpc.adminApiKeys.update.mutationOptions({
      onError: () => {
        toast.error(t('adminApiKeys.updateError'));
      },
      onSuccess: () => {
        toast.success(t('adminApiKeys.updateSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Revoke any user's key. */
export function useAdminDeleteApiKey({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateAdminApiKeys();
  const { t } = useTranslation();
  return useMutation(
    orpc.adminApiKeys.delete.mutationOptions({
      onError: () => {
        toast.error(t('adminApiKeys.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('adminApiKeys.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}
