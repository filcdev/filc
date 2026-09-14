import { permissions } from '@filcdev/api/permissions';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { NavigatorPreview } from '@/components/admin/navigator/navigator-preview';
import { PermissionGuard } from '@/components/util/permission-guard';

export const Route = createFileRoute('/_private/admin/navigator/preview')({
  component: () => (
    <PermissionGuard permission={permissions.navigatorManage}>
      <NavigatorPreviewPage />
    </PermissionGuard>
  ),
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
