import { createFileRoute } from '@tanstack/react-router';
import { PermissionGuard } from '~/frontend/components/permission-guard';

export const Route = createFileRoute('/_private/proba')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <PermissionGuard permission="proba:view">
      <div>Hello "/_private/proba"!</div>
    </PermissionGuard>
  );
}
