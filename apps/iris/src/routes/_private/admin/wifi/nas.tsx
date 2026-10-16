import { permissions } from '@filcdev/api/permissions';
import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@filcdev/ui/components/table';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TableHeaderRow } from '@/components/admin/table-header-row';
import { useConfirm } from '@/components/confirm-provider';
import { PermissionGuard } from '@/components/util/permission-guard';
import { WifiRowActions } from '@/components/wifi/row-actions';
import { WifiNasDialog } from '@/components/wifi/wifi-dialogs';
import { useDeleteWifiNas, useWifiNas, type WifiNas } from '@/hooks/wifi-admin';

export const Route = createFileRoute('/_private/admin/wifi/nas')({
  component: () => (
    <PermissionGuard permission={permissions.wifiRead}>
      <WifiNasPage />
    </PermissionGuard>
  ),
});

function WifiNasPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNas, setEditingNas] = useState<WifiNas | undefined>();

  const query = useWifiNas();
  const deleteNas = useDeleteWifiNas();

  const nasList = query.data?.items ?? [];
  const needle = search.toLowerCase();
  const filteredNas = nasList.filter(
    (nas) =>
      !needle ||
      nas.ipAddress.includes(needle) ||
      nas.macAddress.toLowerCase().includes(needle) ||
      (nas.comment?.toLowerCase() ?? '').includes(needle)
  );

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">
            {t('wifiAdminNas.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('wifiAdminNas.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label={t('wifiAdminNas.refresh')}
            disabled={query.isFetching}
            onClick={() => query.refetch()}
            size="icon"
            variant="outline"
          >
            <RefreshCw
              className={query.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          </Button>
          <Button
            className="gap-2"
            onClick={() => {
              setEditingNas(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('wifiAdminNas.addNas')}</span>
          </Button>
        </div>
      </div>

      <div className="flex max-w-sm items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('wifiAdminNas.searchPlaceholder')}
            value={search}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeaderRow
            columns={[
              { key: 'ipAddress', label: t('wifiAdminNas.ipAddress') },
              { key: 'macAddress', label: t('wifiAdminNas.macAddress') },
              { key: 'comment', label: t('wifiAdminNas.comment') },
              {
                className: 'w-[100px] text-right',
                key: 'actions',
                label: t('wifiAdminNas.actions'),
              },
            ]}
          />
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell className="text-center" colSpan={4}>
                  {t('common.loading')}
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading && filteredNas.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-center text-muted-foreground"
                  colSpan={4}
                >
                  {t('wifiAdminNas.noNasFound')}
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading &&
              filteredNas.map((nas) => (
                <TableRow key={nas.id}>
                  <TableCell className="font-mono text-xs">
                    {nas.ipAddress}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {nas.macAddress}
                  </TableCell>
                  <TableCell>{nas.comment ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    <WifiRowActions
                      onDelete={async () => {
                        const confirmed = await confirm({
                          title: t('wifiAdminNas.deleteConfirmTitle'),
                        });
                        if (confirmed) {
                          deleteNas.mutate({ id: nas.id });
                        }
                      }}
                      onEdit={() => {
                        setEditingNas(nas);
                        setDialogOpen(true);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <WifiNasDialog
        nas={editingNas}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </div>
  );
}
