import { createApiClient, unwrapResponse } from '@filcdev/api/client';
import type {
  KioskRouter,
  NavigatorRouter,
  TimetableRouter,
} from '@filcdev/chronos/types/hc';
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
 * Chronos is always reached by absolute URL: a box runs a static build with
 * nothing in front of it that would proxy a relative `/api`, so dev points at
 * the local Chronos exactly the way production points at the deployed one.
 * `VITE_API_BASE_URL` overrides the host for a box pointed somewhere else.
 */
const baseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV
    ? 'http://localhost:3001/api'
    : 'https://filc.petrik.hu/api');

/** The API base as a URL prefix: image URLs are built from it by hand. */
export const apiBaseUrl = baseUrl;

const clientOptions = {
  // The kiosk surface is public: no session cookie is involved, and sending
  // credentials would force credentialed CORS on every request.
  init: { credentials: 'omit' } satisfies RequestInit,
};

export const api = {
  kiosk: createApiClient<KioskRouter>(`${baseUrl}/kiosk`, clientOptions),
  navigator: createApiClient<NavigatorRouter>(
    `${baseUrl}/navigator`,
    clientOptions
  ),
  timetable: createApiClient<TimetableRouter>(
    `${baseUrl}/timetable`,
    clientOptions
  ),
};

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
