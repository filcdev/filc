import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import css from '~/frontend/global.css?url';
import type { RouterContext } from '~/frontend/router-context';

const queryClient = new QueryClient();

export const Route = createRootRouteWithContext<RouterContext>()({
  notFoundComponent: () => <div>404</div>,
  head: () => ({
    links: [
      {
        rel: 'stylesheet',
        href: css,
      },
      {
        rel: 'icon',
        href: 'data:image/x-icon;base64,',
      },
    ],
    meta: [
      {
        title: 'Filc',
      },
      {
        charSet: 'UTF-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0',
      },
    ],
    scripts: [
      ...(import.meta.env.PROD
        ? []
        : [
            {
              type: 'module',
              children: `import RefreshRuntime from "/@react-refresh"
      					RefreshRuntime.injectIntoGlobalHook(window)
      					window.$RefreshReg$ = () => {}
      					window.$RefreshSig$ = () => (type) => type
      					window.__vite_plugin_react_preamble_installed__ = true`,
            },
            {
              type: 'module',
              src: '/@vite/client',
            },
            {
              type: 'module',
              src: '/src/frontend/index.tsx',
            },
          ]),
      {
        type: 'module',
        src: import.meta.env.PROD
          ? '/static/index.js'
          : '/src/frontend/index.tsx',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <TanStackRouterDevtools position="bottom-right" />
          <Scripts />
        </QueryClientProvider>
      </body>
    </html>
  );
}
