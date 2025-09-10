import { createRouter as createTanstackRouter } from '@tanstack/react-router';
import { routeTree } from '~/frontend/route-tree.gen';
import type { RouterContext } from '~/frontend/router-context';

export function createRouter() {
  return createTanstackRouter({
    routeTree,
    context: {
      head: '',
    } as RouterContext,
    defaultPreload: 'intent',
    scrollRestoration: true,
    defaultStructuralSharing: true,
    defaultPreloadStaleTime: 0,
  });
}

declare module '@tanstack/react-router' {
  // biome-ignore lint/nursery/useConsistentTypeDefinitions: Needed for module augmentation
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
