import { useSession } from '@filcdev/auth/client';
import { Spinner } from '@filcdev/ui/components/spinner';
import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_private')({
  component: AppLayoutComponent,
  // The authenticated tree renders in the browser, but its loaders still run
  // on the server, so the shipped cache is prefetched with the request's own
  // session cookie rather than refetched after hydration.
  ssr: 'data-only',
});

function AppLayoutComponent() {
  const { data, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex grow items-center justify-center gap-1 text-primary text-semibold">
        <Spinner />
      </div>
    );
  }

  // Not every route under this layout has a permission to gate on — `/wifi`
  // is a self-service page with no permission of its own — so the tree's
  // authentication is enforced here. Without it those routes would sit on
  // their loading skeleton forever for an anonymous visitor.
  if (!(data?.session && data?.user)) {
    return <Navigate to="/auth/login" />;
  }

  return <Outlet />;
}
