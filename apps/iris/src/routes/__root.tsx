import { AuthSessionProvider, useSession } from '@filcdev/auth/client';
import { SiteThemeBackdrop } from '@filcdev/ui/components/site-theme-art';
import { Toaster } from '@filcdev/ui/components/sonner';
import {
  applyColorScheme,
  DEFAULT_COLOR_SCHEME,
} from '@filcdev/ui/lib/color-scheme';
import { applySiteTheme, DEFAULT_SITE_THEME } from '@filcdev/ui/lib/site-theme';
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
import { ConfirmProvider } from '@/components/confirm-provider';
import { SettingsDialog } from '@/components/settings-dialog';
import { SettingsDialogProvider } from '@/components/settings-dialog-store';
import { SiteThemeNotice } from '@/components/site-theme-notice';
import { SystemMessageBanner } from '@/components/system-message-banner';
import { CookiePopup } from '@/components/util/cookie-popup';
import { useNotificationSettings } from '@/hooks/notifications';
import { useSiteTheme } from '@/hooks/site-theme';
import { useThemeSync } from '@/hooks/use-theme-sync';
import { createI18n } from '@/utils/i18n';
import { orpc, prefetch } from '@/utils/orpc';
import { fetchLanguage, fetchSession } from '@/utils/request';
import '@/global.css';
import { setSentryUser } from '@/utils/telemetry';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  beforeLoad: async ({ context }) => {
    // The site theme is public and read during SSR so the `<html>` attribute
    // is in the first paint; `prefetch` returns `undefined` (and drops the
    // failed query) when the fetch is refused, so fall back to the default.
    // A signed-in visitor's own palette and their seasonal opt-out have to be
    // in the first paint too, or the skin would flash and then be withdrawn.
    const [language, session, theme] = await Promise.all([
      fetchLanguage(),
      fetchSession(),
      prefetch(
        context.queryClient,
        orpc.theme.get.queryOptions({ staleTime: 5 * 60_000 })
      ),
    ]);

    const preferences = session
      ? await prefetch(
          context.queryClient,
          orpc.notifications.settings.queryOptions()
        )
      : undefined;

    const siteThemeEnabled = preferences?.siteThemeEnabled ?? true;

    return {
      colorScheme: preferences?.colorScheme ?? DEFAULT_COLOR_SCHEME,
      language,
      session,
      siteTheme: siteThemeEnabled
        ? (theme?.theme ?? DEFAULT_SITE_THEME)
        : DEFAULT_SITE_THEME,
    };
  },
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
  const { colorScheme, language, session, siteTheme } = Route.useRouteContext();
  const [i18n] = useState(() => createI18n(language));
  // The server render's values, for the first paint only. The browser decides
  // after that (`AppShell` re-applies both from the live preferences), because
  // the router can re-run `beforeLoad` client-side without a session and would
  // otherwise keep writing the seasonal defaults back over them.
  const [paintTheme] = useState({ colorScheme, siteTheme });

  return (
    // `suppressHydrationWarning` is required by next-themes: its inline script
    // sets `class` and `color-scheme` on <html> before React hydrates, so the
    // server HTML and the first client render legitimately differ. React would
    // otherwise warn on every load and refuse to patch the attributes.
    <html
      data-color-scheme={paintTheme.colorScheme}
      data-site-theme={paintTheme.siteTheme}
      lang={language}
      suppressHydrationWarning
      translate="no"
    >
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

  // The site-wide seasonal skin: prefetched during SSR, applied here so an
  // admin's change takes effect live without a reload. A visitor who turned
  // seasonal skins off keeps `default`, which lets their own scheme through.
  // These effects only run in the browser, so they never touch `document`
  // during a server render.
  const { data: siteTheme } = useSiteTheme();

  useThemeSync(settings?.theme);

  const seasonalEnabled = settings?.siteThemeEnabled ?? true;
  const effectiveSiteTheme = seasonalEnabled
    ? (siteTheme?.theme ?? DEFAULT_SITE_THEME)
    : DEFAULT_SITE_THEME;

  useEffect(() => {
    applySiteTheme(effectiveSiteTheme);
  }, [effectiveSiteTheme]);

  useEffect(() => {
    // Falls back after a sign-out, where there are no stored preferences left
    // to name a palette.
    applyColorScheme(settings?.colorScheme ?? DEFAULT_COLOR_SCHEME);
  }, [settings?.colorScheme]);

  useEffect(() => {
    if (data?.session && data?.user) {
      setSentryUser(data.session, data.user);
    } else {
      setSentryUser(null);
    }
  }, [data]);

  return (
    <SettingsDialogProvider>
      <ConfirmProvider>
        {/* The seasonal motifs, once for the whole app; renders nothing on
            `default`. Kept behind the content by its own `-z-10`. */}
        <SiteThemeBackdrop
          theme={seasonalEnabled ? effectiveSiteTheme : DEFAULT_SITE_THEME}
        />
        <SystemMessageBanner />
        <Outlet />
        {/* Mounted once for the whole app: the profile menu, the notification
            viewer and any future entry point all open this same dialog. */}
        <SettingsDialog />
        <SiteThemeNotice />
        <Toaster />
        <CookiePopup />
      </ConfirmProvider>
    </SettingsDialogProvider>
  );
}
