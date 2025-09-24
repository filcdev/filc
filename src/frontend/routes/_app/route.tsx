import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Navbar } from '~/frontend/components/navbar';

export const Route = createFileRoute('/_app')({
  component: AppLayoutComponent,
});

function AppLayoutComponent() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}
