import { ORPCError } from '@orpc/client';
import { captureException } from '@sentry/react';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { type AnyRouter, createRouter } from '@tanstack/react-router';
import { setupSsrQuery } from '@/utils/ssr-query';

import { routeTree } from './routeTree.gen';

/**
 * A fresh router (and QueryClient) per request, so no state is ever shared
 * between two server renders. The SSR query integration wires the QueryClient
 * into the router lifecycle: it supplies the Query provider, dehydrates the
 * loaders' prefetched cache into the streamed payload and hydrates it in the
 * browser, so a component's own `useQuery` reads that cache instead of
 * refetching.
 */
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          failureCount < 1 &&
          !(
            error instanceof ORPCError &&
            error.status !== undefined &&
            error.status < 500
          ),
        staleTime: 30_000,
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        captureException(error);
      },
    }),
    queryCache: new QueryCache({
      onError: (error) => {
        captureException(error);
      },
    }),
  });

  const router = createRouter({
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultStructuralSharing: true,
    routeTree,
    scrollRestoration: true,
  });

  setupSsrQuery({ queryClient, router: router as AnyRouter });

  return router;
}

/** The router every app route is typed against. */
export type IrisRouter = ReturnType<typeof getRouter>;

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: fine here
  interface Register {
    router: IrisRouter;
  }
}
