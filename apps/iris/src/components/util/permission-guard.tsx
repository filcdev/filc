import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useHasPermission } from '@/hooks/use-has-permission';
import { authClient } from '@/utils/authentication';

type PermissionGuardProps = {
  children: ReactNode;
  permission: string | readonly string[];
};

export function PermissionGuard({
  children,
  permission,
}: PermissionGuardProps) {
  const { data } = authClient.useSession();
  const user = data?.user;
  const hasPermission = useHasPermission(permission, user?.permissions);

  if (!user) {
    return <Navigate to="/auth/login" />;
  }

  if (!hasPermission) {
    return <Navigate search={{ error: 'unauthorized' }} to="/auth/error" />;
  }

  return <>{children}</>;
}
