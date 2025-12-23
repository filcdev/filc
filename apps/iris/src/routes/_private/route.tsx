import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Spinner } from '@/components/ui/spinner';
import { authClient } from '@/utils/authentication';

export const Route = createFileRoute('/_private')({
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  const { isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex grow items-center justify-center gap-1 text-primary text-semibold">
        <Spinner />
      </div>
    );
  }

  return <Outlet />;
}
