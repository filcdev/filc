import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { CohortReselectionBanner } from '@/components/cohort-reselection-banner';
import { SystemMessageBanner } from '@/components/system-message-banner';
import { Toaster } from '@/components/ui/sonner';
import { CookiePopup } from '@/components/util/cookie-popup';
import { useThemeSync } from '@/hooks/use-theme-sync';
import { useApiQuery } from '@/utils/api';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';
import { setSentryUser } from '@/utils/telemetry';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => <div>404</div>,
});

function RootComponent() {
  const { data } = authClient.useSession();

  // Fetch user preferences to sync theme on load
  const { data: settings } = useApiQuery<{ theme: string }>(
    () => api.notifications.settings.$get(),
    {
      enabled: !!data?.session,
      queryKey: queryKeys.notifications.settings(),
    }
  );

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
      <CohortReselectionBanner />
      <SystemMessageBanner />
      <Outlet />
      <Toaster />
      <CookiePopup />
    </>
  );
}
