import { createFileRoute, Outlet } from '@tanstack/react-router';
import { LoaderCircle } from 'lucide-react';
import { authClient } from '@/utils/authentication';

export const Route = createFileRoute('/_private')({
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  const { isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex grow items-center justify-center gap-1 text-semibold">
        <LoaderCircle className="animate-spin text-primary" />
      </div>
    );
  }

  return <Outlet />;
}
