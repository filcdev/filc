import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import type { RouterContext } from '~/frontend/router-context';
import '~/frontend/global.css';

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    links: [{ rel: 'icon', href: '/favicon.ico' }],
    meta: [
      {
        title: 'TanStack Router SSR Basic File Based Streaming',
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
      // ...(!import.meta.env.PROD
      // 	? [
      // 			{
      // 				type: "module",
      // 				children: `import RefreshRuntime from "/@react-refresh"
      // 					RefreshRuntime.injectIntoGlobalHook(window)
      // 					window.$RefreshReg$ = () => {}
      // 					window.$RefreshSig$ = () => (type) => type
      // 					window.__vite_plugin_react_preamble_installed__ = true`,
      // 			},
      // 			{
      // 				type: "module",
      // 				src: "/@vite/client",
      // 			},
      // 			{
      // 				type: "module",
      // 				src: "/src/entry-client.tsx",
      // 			},
      // 		]
      // 	: []),
      {
        // issue 4584 in the Tanstack Router library
        // type: "module",
        // src: import.meta.env.PROD
        // 	? "/static/entry-client.js"
        // 	: "/src/entry-client.tsx",
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
        {/* TODO: remove this once issue 4585 is resolved */}
        {import.meta.env.PROD ? (
          <script src="/static/entry-client.js" type="module" />
        ) : (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `
								import RefreshRuntime from "/@react-refresh"
  								RefreshRuntime.injectIntoGlobalHook(window)
  								window.$RefreshReg$ = () => {}
  								window.$RefreshSig$ = () => (type) => type
  								window.__vite_plugin_react_preamble_installed__ = true`,
              }}
              type="module"
            />
            <script src="/@vite/client" type="module" />
            <script src="/src/frontend/index.tsx" type="module" />
          </>
        )}
      </head>
      <body>
        <Outlet />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
