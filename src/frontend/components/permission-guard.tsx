import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { authClient } from "~/frontend/utils/authentication";

interface PermissionGuardProps {
  children: ReactNode;
  permission: string;
}

export function PermissionGuard({ children, permission }: PermissionGuardProps) {
  const { data } = authClient.useSession();

  if (!data || !data.user.permissions.includes(permission)) {
    return <Navigate to="/auth/error" />;
  }

  return <>
    {children}
  </>;
}