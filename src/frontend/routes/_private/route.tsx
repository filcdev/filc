import { createFileRoute, Outlet } from '@tanstack/react-router';
import { FaSpinner } from 'react-icons/fa6';
import { authClient } from '~/frontend/utils/authentication';

export const Route = createFileRoute('/_private')({
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  const { isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex grow items-center justify-center gap-1 text-semibold">
        <FaSpinner className="animate-spin text-primary" />
      </div>
    );
  }

  return <Outlet />;
}
