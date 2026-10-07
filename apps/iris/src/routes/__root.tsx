import { AuthSessionProvider, useSession } from '@filcdev/auth/client';
import { Toaster } from '@filcdev/ui/components/sonner';
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { CookiesProvider } from 'react-cookie';
import { I18nextProvider } from 'react-i18next';
import { SystemMessageBanner } from '@/components/system-message-banner';
import { CookiePopup } from '@/components/util/cookie-popup';
import { useNotificationSettings } from '@/hooks/notifications';
import { useThemeSync } from '@/hooks/use-theme-sync';
import { createI18n } from '@/utils/i18n';
import { fetchLanguage, fetchSession } from '@/utils/request';
import '@/global.css';
import { setSentryUser } from '@/utils/telemetry';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  beforeLoad: async () => ({
    language: await fetchLanguage(),
    session: await fetchSession(),
  }),
  component: RootComponent,
  head: () => ({
    links: [
      { href: '/assets/favicon-light.png', rel: 'icon', type: 'image/png' },
      {
        href: '/assets/favicon-dark.png',
        media: '(prefers-color-scheme: dark)',
        rel: 'icon',
        type: 'image/png',
      },
      { href: '/assets/favicon-light.png', rel: 'apple-touch-icon' },
    ],
    meta: [
      { charSet: 'utf-8' },
      {
        content: 'width=device-width, initial-scale=1.0',
        name: 'viewport',
      },
      { content: 'light dark', name: 'color-scheme' },
      { content: 'Keeping school life on schedule', name: 'description' },
      { content: 'index,follow', name: 'robots' },
      { content: 'Filc', property: 'og:title' },
      {
        content: 'Keeping school life on schedule',
        property: 'og:description',
      },
      { content: 'website', property: 'og:type' },
      { content: 'https://filc.petrik.hu/', property: 'og:url' },
      {
        content: 'https://filc.petrik.hu/assets/og-banner.jpg',
        property: 'og:image',
      },
      { content: '1200', property: 'og:image:width' },
      { content: '630', property: 'og:image:height' },
      { content: 'Filc', property: 'og:image:alt' },
      { content: 'Filc', property: 'og:site_name' },
      { content: 'en_US', property: 'og:locale' },
      { content: 'hu_HU', property: 'og:locale:alternate' },
      { content: 'summary_large_image', name: 'twitter:card' },
      {
        content: '#ffffff',
        media: '(prefers-color-scheme: light)',
        name: 'theme-color',
      },
      {
        content: '#09090b',
        media: '(prefers-color-scheme: dark)',
        name: 'theme-color',
      },
      { title: 'Filc' },
    ],
  }),
  notFoundComponent: () => <div>404</div>,
});

function RootComponent() {
  const { language, session } = Route.useRouteContext();
  const [i18n] = useState(() => createI18n(language));

  return (
    <html lang={language} translate="no">
      <head>
        <HeadContent />
      </head>
      <body className="h-dvh">
        <AuthSessionProvider session={session}>
          <CookiesProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <I18nextProvider i18n={i18n}>
                <AppShell />
              </I18nextProvider>
            </ThemeProvider>
          </CookiesProvider>
        </AuthSessionProvider>
        <Scripts />
      </body>
    </html>
  );
}

function AppShell() {
  const { data } = useSession();

  // Fetch user preferences to sync theme on load
  const { data: settings } = useNotificationSettings(!!data?.session);

  useThemeSync(settings?.theme);

  useEffect(() => {
    if (data?.session && data?.user) {
      setSentryUser(data.session, data.user);
    } else {
      setSentryUser(null);
    }
  }, [data]);

  return (
    <>
      <SystemMessageBanner />
      <Outlet />
      <Toaster />
      <CookiePopup />
    </>
  );
}
