import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import { CookiePopup } from '@/components/util/cookie-popup';

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => <div>404</div>,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster richColors />
      <CookiePopup />
    </>
  );
}
