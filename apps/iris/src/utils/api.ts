import {
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import { type ClientResponse, parseResponse } from 'hono/client';

type ApiEnvelope = {
  success: boolean;
  data?: unknown;
  error?: unknown;
};

/**
 * Runs a hono `hc` request through `parseResponse` and unwraps the
 * `{ data, success }` envelope the chronos backend returns. `T` is the type of
 * `data` (not the full envelope). Throws with the backend `error` message on
 * failure so React Query surfaces it as `error`.
 */
async function unwrap<T>(
  call: () => Promise<ClientResponse<unknown>>
): Promise<T> {
  const res = (await parseResponse(call())) as unknown as ApiEnvelope;
  if (!res.success) {
    throw new Error(
      typeof res.error === 'string' ? res.error : 'Request failed'
    );
  }
  return res.data as T;
}

export type ApiQueryOptions<T> = Omit<
  UseQueryOptions<T, Error>,
  'queryFn' | 'queryKey'
> & {
  queryKey: UseQueryOptions<T, Error>['queryKey'];
};

/** Build a typed `useQuery` that auto-unwraps the backend envelope. */
export function useApiQuery<T>(
  request: () => Promise<ClientResponse<unknown>>,
  options: ApiQueryOptions<T>
): UseQueryResult<T, Error> {
  return useQuery<T, Error>({
    ...options,
    queryFn: () => unwrap<T>(request),
  });
}

export type ApiMutationOptions<TData, TVariables> = Omit<
  UseMutationOptions<TData, Error, TVariables>,
  'mutationFn'
> & {
  mutationFn: (variables: TVariables) => Promise<ClientResponse<unknown>>;
};

/** Build a typed `useMutation` that auto-unwraps the backend envelope. */
export function useApiMutation<TData, TVariables = void>(
  options: ApiMutationOptions<TData, TVariables>
): UseMutationResult<TData, Error, TVariables> {
  return useMutation<TData, Error, TVariables>({
    ...options,
    mutationFn: (variables) =>
      unwrap<TData>(() => options.mutationFn(variables)),
  });
}
