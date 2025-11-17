import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouteContext,
} from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { Toaster } from '~/frontend/components/ui/sonner';
import { CookiePopup } from '~/frontend/components/util/cookie-popup';
import css from '~/frontend/global.css?url';
import type { RouterContext } from '~/frontend/router-context';

const queryClient = new QueryClient();

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  head: () => ({
    links: [
      {
        href: css,
        rel: 'stylesheet',
      },
      {
        href: 'data:image/x-icon;base64,',
        rel: 'icon',
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
        content: 'width=device-width, initial-scale=1.0',
        name: 'viewport',
      },
    ],
    scripts: [
      ...(import.meta.env.PROD
        ? []
        : [
            {
              children: `import RefreshRuntime from "/@react-refresh"
      					RefreshRuntime.injectIntoGlobalHook(window)
      					window.$RefreshReg$ = () => {}
      					window.$RefreshSig$ = () => (type) => type
      					window.__vite_plugin_react_preamble_installed__ = true`,
              type: 'module',
            },
            {
              src: '/@vite/client',
              type: 'module',
            },
            {
              src: '/src/frontend/client.tsx',
              type: 'module',
            },
          ]),
      {
        src: import.meta.env.PROD
          ? '/static/client.js'
          : '/src/frontend/client.tsx',
        type: 'module',
      },
    ],
  }),
  notFoundComponent: () => <div>404</div>,
});

function RootComponent() {
  const { i18n } = useRouteContext({
    from: '__root__',
  });

  return (
    <html
      className="h-dvh scroll-smooth bg-background text-foreground"
      lang={i18n.language}
    >
      <head>
        <HeadContent />
      </head>
      <body className="flex h-full flex-col">
        <QueryClientProvider client={queryClient}>
          <Outlet />
          {import.meta.env.DEV
            ? // Lazy-load devtools only in development. This dynamic import
              // is compile-time stripped from production by Vite.
              (() => {
                const RouterDevtools = lazy(() =>
                  import('@tanstack/react-router-devtools').then((m) => ({
                    default: m.TanStackRouterDevtools,
                  }))
                );
                return (
                  <Suspense>
                    <RouterDevtools position="bottom-right" />
                  </Suspense>
                );
              })()
            : null}
          <Scripts />
          <Toaster richColors />
          <CookiePopup />
        </QueryClientProvider>
      </body>
    </html>
  );
}
