import { Spinner } from '@filcdev/ui/components/spinner';
import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router';
import { authClient } from '@/utils/authentication';

export const Route = createFileRoute('/_private')({
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  const { isPending, data } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex grow items-center justify-center gap-1 text-primary text-semibold">
        <Spinner />
      </div>
    );
  }

  if (!(data?.session && data?.user)) {
    return <Navigate to="/auth/login" />;
  }

  return <Outlet />;
}
