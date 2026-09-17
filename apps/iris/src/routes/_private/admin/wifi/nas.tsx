import type { WifiNas } from '@filcdev/api/domains/wifi/admin';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Plus, RefreshCw, Search, Trash } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { WifiNasDialog } from '@/components/wifi/wifi-dialogs';
import { useDeleteWifiNas, useWifiNas } from '@/hooks/wifi-admin';

export const Route = createFileRoute('/_private/admin/wifi/nas')({
  component: WifiNasPage,
});

function WifiNasPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNas, setEditingNas] = useState<WifiNas | undefined>();

  const query = useWifiNas();
  const deleteMutation = useDeleteWifiNas();

  const handleEdit = (nas: WifiNas) => {
    setEditingNas(nas);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingNas(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = (nas: WifiNas) => {
    if (window.confirm(t('wifiAdminNas.deleteConfirmTitle'))) {
      deleteMutation.mutate(nas.id);
    }
  };

  const nasList = query.data ?? [];
  const filteredNas = nasList.filter(
    (n) =>
      !search ||
      n.ipAddress.includes(search) ||
      n.macAddress.toLowerCase().includes(search.toLowerCase()) ||
      n.comment?.toLowerCase().includes(search.toLowerCase())
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
            disabled={query.isFetching}
            onClick={() => query.refetch()}
            size="icon"
            variant="outline"
          >
            <RefreshCw
              className={query.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
          </Button>
          <Button className="gap-2" onClick={handleCreate}>
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('wifiAdminNas.searchPlaceholder')}
            value={search}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('wifiAdminNas.ipAddress')}</TableHead>
              <TableHead>{t('wifiAdminNas.macAddress')}</TableHead>
              <TableHead>{t('wifiAdminNas.comment')}</TableHead>
              <TableHead className="w-[100px] text-right">
                {t('wifiAdminNas.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {(() => {
                if (query.isLoading) {
                  return (
                    <TableRow>
                      <TableCell className="text-center" colSpan={4}>
                        {t('common.loading')}
                      </TableCell>
                    </TableRow>
                  );
                }

                if (filteredNas.length === 0) {
                  return (
                    <TableRow>
                      <TableCell className="text-center text-muted-foreground" colSpan={4}>
                        {t('wifiAdminNas.noNasFound')}
                      </TableCell>
                    </TableRow>
                  );
                }

                return filteredNas.map((nas) => (
                  <TableRow key={nas.id}>
                    <TableCell className="font-mono text-xs">{nas.ipAddress}</TableCell>
                    <TableCell className="font-mono text-xs">{nas.macAddress}</TableCell>
                    <TableCell>{nas.comment ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => handleEdit(nas)}
                          size="icon"
                          variant="ghost"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          className="text-destructive"
                          onClick={() => handleDelete(nas)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
        </Table>
      </div>

      {isDialogOpen && (
        <WifiNasDialog
          nas={editingNas}
          onOpenChange={setIsDialogOpen}
          open={isDialogOpen}
        />
      )}
    </div>
  );
}
