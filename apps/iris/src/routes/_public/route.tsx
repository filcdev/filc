import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Navbar } from '@/components/ui/navbar';

export const Route = createFileRoute('/_public')({
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  return (
    <>
      <Navbar showLogo={true} />
      <Outlet />
    </>
  );
}
