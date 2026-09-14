import { Toaster } from '@filcdev/ui/components/sonner';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { SystemMessageBanner } from '@/components/system-message-banner';
import { CookiePopup } from '@/components/util/cookie-popup';
import { useNotificationSettings } from '@/hooks/notifications';
import { useThemeSync } from '@/hooks/use-theme-sync';
import { authClient } from '@/utils/authentication';
import { setSentryUser } from '@/utils/telemetry';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => <div>404</div>,
});

function RootComponent() {
  const { data } = authClient.useSession();

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
