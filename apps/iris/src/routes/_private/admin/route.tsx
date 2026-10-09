import {
  SidebarProvider,
  SidebarTrigger,
} from '@filcdev/ui/components/sidebar';
import {
  createFileRoute,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminSidebar } from '@/components/admin/sidebar';
import { Lazy } from '@/components/lazy';
import { Navbar } from '@/components/navbar';
import { PermissionGuard } from '@/components/util/permission-guard';
import { ADMIN_UI_PERMISSIONS } from '@/hooks/use-has-permission';
import { orpc, prefetch } from '@/utils/orpc';

// Only the dashboard renders the chart, but this layout wraps every admin page,
// so a static import would pull recharts into all of them. Load it on demand.
const loadAdminDashboard = () =>
  import('@/components/admin/dashboard').then((m) => ({
    default: m.AdminDashboard,
  }));

export const Route = createFileRoute('/_private/admin')({
  component: AppLayoutComponent,
  // The admin index is the dashboard; its own routes prefetch their own data.
  loader: ({ context, location }) =>
    location.pathname === '/admin'
      ? prefetch(
          context.queryClient,
          orpc.dashboard.stats.queryOptions({ input: { days: 30 } })
        )
      : undefined,
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
        <main className="flex min-w-0 grow flex-col">
          <Navbar showLinks={false} showLogo={false}>
            <SidebarTrigger />
          </Navbar>

          <div className="grow overflow-auto p-4">
            {isExactAdminPath ? <Lazy load={loadAdminDashboard} /> : <Outlet />}
          </div>
        </main>
      </SidebarProvider>
    </PermissionGuard>
  );
}
