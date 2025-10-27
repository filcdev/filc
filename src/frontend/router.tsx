import { createRouter as createTanstackRouter } from '@tanstack/react-router';
import { routeTree } from '~/frontend/route-tree.gen';
import type { RouterContext } from '~/frontend/router-context';

export function createRouter() {
  return createTanstackRouter({
    context: {
      head: '',
    } as RouterContext,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultStructuralSharing: true,
    routeTree,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Needed for module augmentation
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
