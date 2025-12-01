import { createRouter, RouterProvider } from '@tanstack/react-router';
import i18next from 'i18next';
import Backend from 'i18next-http-backend';
import { StrictMode } from 'react';
import { CookiesProvider } from 'react-cookie';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

// Import the generated route tree
import { routeTree } from './route-tree.gen';

import './global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { reportWebVitals } from '@/utils/web-vitals';

// Create a new router instance
const router = createRouter({
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultStructuralSharing: true,
  routeTree,
  scrollRestoration: true,
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: fine here
  interface Register {
    router: typeof router;
  }
}

const i18n = i18next.createInstance();
await i18n.use(Backend).init({
  backend: {
    loadPath: `${origin}/locales/{{lng}}/{{ns}}.json`,
  },
  defaultNS: 'translation',
  fallbackLng: 'hu',
  interpolation: { escapeValue: false },
  ns: ['translation'],
  react: { useSuspense: false },
  supportedLngs: ['en', 'hu'],
});

const queryClient = new QueryClient();

// Render the app
const rootElement = document.getElementById('app');
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <CookiesProvider>
        <QueryClientProvider client={queryClient}>
          <I18nextProvider i18n={i18n}>
            <RouterProvider router={router} />
          </I18nextProvider>
        </QueryClientProvider>
      </CookiesProvider>
    </StrictMode>
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
