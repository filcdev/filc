import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminSidebar } from '@/components/admin/sidebar';
import { Navbar } from '@/components/navbar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { authClient } from '@/utils/authentication';

export const Route = createFileRoute('/_private/admin')({
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = t('PageTitles.adminPanel');
  }, [t]);

  useEffect(() => {
    if (session?.user && !session.user.roles.includes('admin')) {
      navigate({
        replace: true,
        to: '/',
      });
    }
  }, [session, navigate]);

  return (
    <SidebarProvider>
      <AdminSidebar />
      <main className="flex grow flex-col">
        <Navbar showLinks={false} showLogo={false}>
          <SidebarTrigger />
        </Navbar>

        <div className="grow overflow-auto p-4">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
}
