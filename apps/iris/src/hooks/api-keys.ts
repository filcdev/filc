import { useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useApiMutation, useApiQuery } from '@/utils/api';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type ApiKeysResponse = InferResponseType<
  (typeof api.users.me)['api-keys']['$get']
>;
export type ApiKeysData = NonNullable<ApiKeysResponse['data']>;
export type ApiKeyItem = ApiKeysData['apiKeys'][number];

export type CreateApiKeyData = NonNullable<
  InferResponseType<(typeof api.users.me)['api-keys']['$post']>['data']
>;

type CreateApiKeyPayload = InferRequestType<
  (typeof api.users.me)['api-keys']['$post']
>['json'];

/** All API keys belonging to the signed-in user. */
export function useApiKeys() {
  return useApiQuery<ApiKeysData>(() => api.users.me['api-keys'].$get(), {
    queryKey: queryKeys.apiKeys.list(),
  });
}

/** Create a new API key; surfaces the one-time `rawKey` to the caller. */
export function useCreateApiKey({
  onSuccess,
}: {
  onSuccess?: (data: CreateApiKeyData) => void;
} = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useApiMutation<CreateApiKeyData, CreateApiKeyPayload>({
    mutationFn: (payload) => api.users.me['api-keys'].$post({ json: payload }),
    onError: (error: Error) => {
      toast.error(error.message || t('apiKeys.createError'));
    },
    onSuccess: (data) => {
      toast.success(t('apiKeys.createSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.list() });
      onSuccess?.(data);
    },
  });
}

/** Revoke an API key. */
export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useApiMutation<void, string>({
    mutationFn: (id) =>
      api.users.me['api-keys'][':id'].$delete({ param: { id } }),
    onError: (error: Error) => {
      toast.error(error.message || t('apiKeys.revokeError'));
    },
    onSuccess: () => {
      toast.success(t('apiKeys.revokeSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.list() });
    },
  });
}
