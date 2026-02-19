import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminSidebar } from '@/components/admin/sidebar';
import { Navbar } from '@/components/ui/navbar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

export const Route = createFileRoute('/_private/admin')({
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('PageTitles.adminPanel');
  }, [t]);

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
