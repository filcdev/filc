import { createApiClient } from '@filcdev/api/client';
import type {
  EnsureQueryDataOptions,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';
import { createIsomorphicFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { requestOrigin } from '@/utils/request';

/** The API base as a URL prefix: image URLs are built from it by hand. */
export const apiBaseUrl = '/api';

/**
 * Absolute origin for a server render whose own origin could not be read.
 *
 * oRPC builds a `URL` from this value, so a relative one is fatal: the call
 * throws `Failed to construct 'URL': Invalid URL` before anything is sent.
 * That is why the fallback has to be absolute and not `apiBaseUrl`. In
 * development it points straight at Chronos, which is also where the Vite
 * proxy sends `/api`; in production the request origin is always available and
 * this is only a safety net.
 */
const fallbackApiOrigin =
  import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:3001';

const client = createIsomorphicFn()
  .client(() =>
    createApiClient({
      credentials: 'include',
      // Absolute, not the relative `/api/rpc`: oRPC's link codec builds a
      // `URL` from this value, and the browser constructor rejects a relative
      // one outright, so every browser-side call threw before it was sent.
      // The page's own origin is the right host — iris and Chronos share one
      // origin through the dev proxy and the platform proxy alike.
      url: () => `${window.location.origin}${apiBaseUrl}/rpc`,
    })
  )
  .server(() =>
    createApiClient({
      headers: () => new Headers(getRequestHeaders()),
      // The origin the request came in on, so a server render talks to the
      // same deployment the browser would (iris and Chronos share one public
      // origin). `requestOrigin` honours `x-forwarded-*`, which `getRequest`
      // does not — behind the platform proxy the two disagree.
      url: () => `${requestOrigin() ?? fallbackApiOrigin}${apiBaseUrl}/rpc`,
    })
  )();

const { client: rpcClient, orpc } = client;

export { orpc };
/** Imperative calls, outside React Query. */
export const api = rpcClient;

/**
 * Fill the render's query cache with one query, dropping a refused one.
 *
 * Every screen is reachable without a session, so a server-side prefetch of
 * session-scoped data is refused for an anonymous visitor. The failed query has
 * to leave the cache again — a dehydrated error state is what the browser
 * would hydrate and render — so the browser refetches once it knows who it is.
 */
export const prefetch = async <
  TQueryFnData,
  TError,
  TData,
  TQueryKey extends QueryKey,
>(
  queryClient: QueryClient,
  options: EnsureQueryDataOptions<TQueryFnData, TError, TData, TQueryKey>
): Promise<TData | undefined> => {
  try {
    return await queryClient.ensureQueryData(options);
  } catch {
    queryClient.removeQueries({ queryKey: options.queryKey });
    return undefined;
  }
};
