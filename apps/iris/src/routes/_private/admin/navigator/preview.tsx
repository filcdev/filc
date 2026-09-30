import { permissions } from '@filcdev/api/permissions';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NavigatorPreview } from '@/components/admin/navigator/navigator-preview';
import { PermissionGuard } from '@/components/util/permission-guard';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/navigator/preview')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <NavigatorPreviewPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    prefetch(context.queryClient, orpc.navigator.graph.queryOptions()),
});

function NavigatorPreviewPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('navigator.preview.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('navigator.preview.description')}
        </p>
      </div>

      <NavigatorPreview />
    </div>
  );
}
