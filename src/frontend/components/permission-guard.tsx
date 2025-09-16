import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { authClient } from '~/frontend/utils/authentication';

type PermissionGuardProps = {
  children: ReactNode;
  permission: string;
};

export function PermissionGuard({
  children,
  permission,
}: PermissionGuardProps) {
  const { data } = authClient.useSession();

  if (!data?.user.permissions.includes(permission)) {
    return <Navigate to="/auth/error" />;
  }

  return <>{children}</>;
}
