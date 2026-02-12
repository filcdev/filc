import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/components/util/permission-guard';

export const Route = createFileRoute('/_private/proba')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <PermissionGuard permission="proba:view">
      <div>Hello "/_private/proba"!</div>
      <Button
        onClick={() => {
          throw new Error('Test error');
        }}
      >
        Throw test error
      </Button>
    </PermissionGuard>
  );
}
