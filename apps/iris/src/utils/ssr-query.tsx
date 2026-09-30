import {
  type DehydratedState,
  dehydrate,
  hydrate,
  type QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import { Fragment, type ReactNode } from 'react';

/**
 * Wire the per-request QueryClient into the router, for the server render and
 * for the browser that hydrates it.
 *
 * This replaces `@tanstack/react-router-ssr-query`, whose newest release
 * (1.167.3, and the package is no longer published in step with the router)
 * implements the pre-1.169 dehydrate contract: it pushes queries into a
 * ReadableStream the router used to drain. The router installed here
 * (1.170/1.171) instead *awaits* `router.options.dehydrate()` and serialises
 * whatever it returns as `dehydratedData`. That package's hook returns
 * `undefined`, so the SSR payload shipped no query state at all: the browser
 * hydrated with an empty cache, every query whose input came from that cache
 * stayed `enabled: false`, and the page only recovered on a refresh.
 *
 * Only queries settled by the end of the render are dehydrated. One that lands
 * afterwards is simply fetched by the browser, which is what used to happen
 * for everything.
 */
export function setupSsrQuery({
  queryClient,
  router,
}: {
  queryClient: QueryClient;
  router: AnyRouter;
}): void {
  const OriginalWrap = router.options.Wrap ?? Fragment;
  router.options.Wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <OriginalWrap>{children}</OriginalWrap>
    </QueryClientProvider>
  );

  if (typeof window !== 'undefined') {
    const originalHydrate = router.options.hydrate;
    router.options.hydrate = async (dehydrated) => {
      await originalHydrate?.(dehydrated);
      const queries = (dehydrated as { query?: { initial?: unknown } }).query
        ?.initial as DehydratedState['queries'] | undefined;
      if (queries) {
        hydrate(queryClient, { queries });
      }
    };
    return;
  }

  const originalDehydrate = router.options.dehydrate;
  router.options.dehydrate = async () => {
    const dehydrated = await originalDehydrate?.();
    return {
      ...dehydrated,
      query: { initial: dehydrate(queryClient).queries },
    };
  };
}
