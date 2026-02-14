import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { CookiePopup } from '@/components/util/cookie-popup';
import { authClient } from '@/utils/authentication';
import { setSentryUser } from '@/utils/telemetry';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => <div>404</div>,
});

function RootComponent() {
  // Get session data to set Sentry user context
  const { data } = authClient.useSession();

  // Update Sentry user context when session changes
  useEffect(() => {
    if (data?.session && data?.user) {
      setSentryUser(data.session, data.user);
    } else {
      setSentryUser(null);
    }
  }, [data]);

  return (
    <>
      <Outlet />
      <Toaster />
      <CookiePopup />
    </>
  );
}
