import type { KioskKind } from '@filcdev/api/domains/kiosk/config';
import { permissions } from '@filcdev/api/permissions';
import { Badge } from '@filcdev/ui/components/badge';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KioskDialog } from '@/components/admin/kiosk-dialog';
import {
  EntityTable,
  type EntityTableColumn,
} from '@/components/admin/navigator/entity-table';
import { PageHeader } from '@/components/admin/page-header';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { type KioskRow, useDeleteKiosk, useKiosks } from '@/hooks/kiosks';
import { orpc, prefetch } from '@/utils/orpc';

dayjs.extend(relativeTime);

export const Route = createFileRoute('/_private/admin/kiosks')({
  component: () => (
    <PermissionGuard permission={permissions.kiosksManage}>
      <KiosksPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    prefetch(context.queryClient, orpc.kiosk.list.queryOptions()),
});

function KiosksPage() {
  const { t } = useTranslation();
  const kiosks = useKiosks();
  const deleteKiosk = useDeleteKiosk();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKiosk, setEditingKiosk] = useState<KioskRow | null>(null);

  const kindLabels: Record<KioskKind, string> = {
    navigator: t('kiosk.kindNavigator'),
    tv: t('kiosk.kindTv'),
  };

  const columns: EntityTableColumn<KioskRow>[] = [
    {
      header: t('kiosk.fields.name'),
      key: 'name',
      render: (kiosk) => kiosk.name,
    },
    {
      header: t('kiosk.fields.kind'),
      key: 'kind',
      render: (kiosk) => (
        <Badge variant="outline">{kindLabels[kiosk.kind]}</Badge>
      ),
    },
    {
      className: 'font-mono text-xs',
      header: t('kiosk.fields.machineId'),
      key: 'machineId',
      render: (kiosk) => kiosk.machineId,
    },
    {
      header: t('kiosk.fields.lastSeen'),
      key: 'lastSeen',
      render: (kiosk) =>
        kiosk.lastSeenAt ? dayjs(kiosk.lastSeenAt).fromNow() : t('kiosk.never'),
    },
    {
      header: t('kiosk.fields.enabled'),
      key: 'enabled',
      render: (kiosk) => (kiosk.enabled ? t('common.yes') : t('common.no')),
    },
  ];

  const startCreate = () => {
    setEditingKiosk(null);
    setDialogOpen(true);
  };

  const startEdit = (kiosk: KioskRow) => {
    setEditingKiosk(kiosk);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        addLabel={t('kiosk.create')}
        description={t('kiosk.description')}
        onAdd={startCreate}
        onRefresh={() => kiosks.refetch()}
        title={t('kiosk.title')}
      />

      <QueryBoundary data={kiosks.data} query={kiosks}>
        {(rows) => (
          <EntityTable
            columns={columns}
            deleteConfirmDescription={(kiosk) =>
              t('kiosk.deleteConfirmDescription', { name: kiosk.name })
            }
            deleteConfirmTitle={t('kiosk.deleteConfirmTitle')}
            getRowId={(kiosk) => kiosk.id}
            getRowLabel={(kiosk) => kiosk.name}
            onDelete={(kiosk) => deleteKiosk.mutate({ id: kiosk.id })}
            onEdit={startEdit}
            rows={rows}
          />
        )}
      </QueryBoundary>

      <KioskDialog
        key={`${dialogOpen ? 'open' : 'closed'}:${editingKiosk?.id ?? 'new'}`}
        kiosk={editingKiosk}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </div>
  );
}
