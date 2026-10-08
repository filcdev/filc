import { type ApiKey, type ApiKeyRow, authClient } from '@filcdev/auth/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/** One API key as the list endpoint returns it — never the raw secret. */
export type UserApiKey = ApiKeyRow;

/** Options accepted by every mutation hook: react to a successful save. */
export type ApiKeyMutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** `create` also hands back the raw secret, so it takes one more callback. */
export type CreateApiKeyCallbacks = ApiKeyMutationCallbacks & {
  /** Receives the created key, whose `key` field is the raw secret. */
  onCreated?: (apiKey: ApiKey) => void;
};

/**
 * better-auth answers `{ data, error }` instead of throwing, so a failure would
 * otherwise read as a React Query *success*. Every call below routes the two
 * halves through this, which turns the error half into a real `Error` — keeping
 * the server's message — so `onError` and `isError` behave as usual.
 */
function unwrap<T>(
  data: T | null,
  error: { message?: string } | null,
  fallback: string
): T {
  if (data === null) {
    throw new Error(error?.message || fallback);
  }
  return data;
}

/**
 * Every API key owned by `userId`; the query stays idle until a session is
 * known.
 *
 * The endpoints are better-auth's, not oRPC's, so there is no generated query
 * key to reuse; scoping the key by user id keeps one user's cache from being
 * served to the next after a sign-in.
 */
export function useApiKeys(userId: string | undefined) {
  return useQuery({
    enabled: userId !== undefined,
    queryFn: async () => {
      const result = await authClient.apiKey.list({ query: {} });
      return unwrap(result.data, result.error, 'Failed to load API keys');
    },
    queryKey: ['api-keys', userId],
  });
}

/** Create a key. The resolved payload carries the raw secret exactly once. */
export function useCreateApiKey({
  onCreated,
  onSaved,
}: CreateApiKeyCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: { expiresIn?: number; name: string }) => {
      const result = await authClient.apiKey.create(input);
      return unwrap(result.data, result.error, t('apiKeys.createError'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('apiKeys.createError'));
    },
    onSuccess: (apiKey) => {
      toast.success(t('apiKeys.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      // The secret exists only on this response, so it is handed to the caller
      // *before* `onSaved` — which is what lets a dialog close on save while
      // still having captured the key.
      onCreated?.(apiKey);
      onSaved?.();
    },
  });
}

/** Rename a key or flip its `enabled` flag. */
export function useUpdateApiKey({ onSaved }: ApiKeyMutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: {
      enabled?: boolean;
      keyId: string;
      name?: string;
    }) => {
      const result = await authClient.apiKey.update(input);
      return unwrap(result.data, result.error, t('apiKeys.updateError'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('apiKeys.updateError'));
    },
    onSuccess: () => {
      toast.success(t('apiKeys.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      onSaved?.();
    },
  });
}

/** Revoke a key: the secret becomes unusable immediately and cannot be restored. */
export function useDeleteApiKey({ onSaved }: ApiKeyMutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: { keyId: string }) => {
      const result = await authClient.apiKey.delete(input);
      return unwrap(result.data, result.error, t('apiKeys.deleteError'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('apiKeys.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('apiKeys.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      onSaved?.();
    },
  });
}
