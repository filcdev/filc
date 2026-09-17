import { createRootRoute, Outlet } from '@tanstack/react-router';

/** No chrome of any kind: a kiosk box shows one page from boot to shutdown. */
export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex h-screen w-screen items-center justify-center">
      <span className="text-lg">Az oldal nem található.</span>
    </div>
  ),
});

function RootComponent() {
  return <Outlet />;
}
