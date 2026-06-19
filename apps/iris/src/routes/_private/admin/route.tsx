import {
  createFileRoute,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminDashboard } from '@/components/admin/dashboard';
import { AdminSidebar } from '@/components/admin/sidebar';
import { Navbar } from '@/components/navbar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { PermissionGuard } from '@/components/util/permission-guard';
import { ADMIN_UI_PERMISSIONS } from '@/hooks/use-has-permission';

export const Route = createFileRoute('/_private/admin')({
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  const { t } = useTranslation();
  const routerState = useRouterState();

  useEffect(() => {
    document.title = t('PageTitles.adminPanel');
  }, [t]);

  const isExactAdminPath =
    routerState.matches.length > 0 &&
    routerState.matches.at(-1)?.routeId === '/_private/admin';

  return (
    <PermissionGuard permission={ADMIN_UI_PERMISSIONS}>
      <SidebarProvider>
        <AdminSidebar />
        <main className="flex grow flex-col">
          <Navbar showLinks={false} showLogo={false}>
            <SidebarTrigger />
          </Navbar>

          <div className="grow overflow-auto p-4">
            {isExactAdminPath ? <AdminDashboard /> : <Outlet />}
          </div>
        </main>
      </SidebarProvider>
    </PermissionGuard>
  );
}
