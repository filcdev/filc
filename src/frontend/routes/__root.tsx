import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Toaster } from '~/frontend/components/ui/sonner';
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
              src: '/src/frontend/client.tsx',
            },
          ]),
      {
        type: 'module',
        src: import.meta.env.PROD
          ? '/static/client.js'
          : '/src/frontend/client.tsx',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { i18n } = useTranslation();

  return (
    <html
      className="h-dvh scroll-smooth bg-background text-foreground"
      lang="en"
    >
      <head>
        <HeadContent />
      </head>
      <body className="flex h-full flex-col">
        <QueryClientProvider client={queryClient}>
          {i18n.isInitializing ? (
            <div className="flex grow items-center justify-center gap-1 text-semibold">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <Outlet />
          )}
          <TanStackRouterDevtools position="bottom-right" />
          <Scripts />
          <Toaster richColors />
        </QueryClientProvider>
      </body>
    </html>
  );
}
