import { unwrapResponse } from '@filcdev/api/client';
import {
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import type { ClientResponse } from 'hono/client';

/**
 * Runs a hono `hc` request through the shared `unwrapResponse` helper, which
 * unwraps the `{ data, success }` envelope and throws a structured `ApiError`
 * on failure so React Query surfaces code/status instead of message strings.
 * `T` is the type of `data` (not the full envelope).
 */
function unwrap<T>(call: () => Promise<ClientResponse<unknown>>): Promise<T> {
  return unwrapResponse<T>(call() as never);
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
