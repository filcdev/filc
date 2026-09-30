import { useSession } from '@filcdev/auth/client';
import { Spinner } from '@filcdev/ui/components/spinner';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_private')({
  component: AppLayoutComponent,
  // The authenticated tree renders in the browser, but its loaders still run
  // on the server, so the shipped cache is prefetched with the request's own
  // session cookie rather than refetched after hydration.
  ssr: 'data-only',
});

function AppLayoutComponent() {
  const { isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex grow items-center justify-center gap-1 text-primary text-semibold">
        <Spinner />
      </div>
    );
  }

  return <Outlet />;
}
