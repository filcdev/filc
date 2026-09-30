import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
// Type-only: the contract carries zod schemas and must stay out of the browser
// bundle. `verbatimModuleSyntax` erases this import.
import type { appContract } from '../contract';

export type ApiClient = ContractRouterClient<typeof appContract>;

export type ApiClientOptions = {
  /**
   * Base RPC URL. A function is re-evaluated per call, so a server render can
   * resolve the origin of the request it is serving.
   */
  url: string | (() => string | Promise<string>);
  credentials?: RequestCredentials;
  /** Extra headers per call — the incoming request's, during SSR. */
  headers?: () => Headers;
};

/**
 * Build the typed oRPC client the apps talk to Chronos with.
 * `orpc` wraps the same client for React Query (`orpc.x.y.queryOptions()`,
 * `.mutationOptions()`, `.key()`); `client` is for imperative calls.
 */
export function createApiClient(options: ApiClientOptions) {
  const link = new RPCLink({
    fetch: (request, init) =>
      fetch(request, {
        ...init,
        credentials: options.credentials ?? 'same-origin',
      }),
    // `exactOptionalPropertyTypes` is on in this package, so an absent header
    // function may not be passed as `undefined`.
    ...(options.headers ? { headers: options.headers } : {}),
    url: options.url,
  });

  const client: ApiClient = createORPCClient(link);

  return { client, orpc: createTanstackQueryUtils(client) };
}
