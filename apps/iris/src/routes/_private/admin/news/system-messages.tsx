import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import { Button } from '@filcdev/ui/components/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { createFileRoute } from '@tanstack/react-router';
import { Pen, Trash } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteConfirmDialog } from '@/components/admin/delete-confirm-dialog';
import { NewsItemDialog } from '@/components/admin/news-item-dialog';
import { TableToolbar } from '@/components/admin/table-toolbar';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type SystemMessageItem,
  useAdminSystemMessages,
  useCohorts,
  useDeleteSystemMessage,
} from '@/hooks/news';
import { useHasPermission } from '@/hooks/use-has-permission';
import { useSortable } from '@/hooks/use-sortable';
import { formatLocalizedDate } from '@/utils/date-locale';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/news/system-messages')({
  component: () => (
    <PermissionGuard permission={permissions.systemMessagesManage}>
      <SystemMessagesPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    Promise.all([
      prefetch(
        context.queryClient,
        orpc.news.systemMessages.list.queryOptions({ input: {} })
      ),
      prefetch(context.queryClient, orpc.cohort.cohort.queryOptions()),
    ]),
});

function SystemMessagesPage() {
  const { i18n, t } = useTranslation();
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SystemMessageItem | null>(
    null
  );
  const itemToDelete = useRef<SystemMessageItem | null>(null);

  const hasManagePermission = useHasPermission(
    permissions.systemMessagesManage,
    session?.user?.permissions
  );

  const systemMessagesQuery = useAdminSystemMessages(hasManagePermission);
  const { data: cohortsData } = useCohorts(hasManagePermission);

  const deleteMutation = useDeleteSystemMessage({
    onSaved: () => {
      setDeleteDialogOpen(false);
      itemToDelete.current = null;
    },
  });

  // The search filter stays here; only the ordering is delegated.
  const filtered = useMemo(() => {
    const list = systemMessagesQuery.data ?? [];
    const term = search.trim().toLowerCase();

    if (!term) {
      return list;
    }

    return list.filter((message) => {
      const titleMatches = message.title.toLowerCase().includes(term);
      const cohortsMatch = message.cohortIds.some((id) =>
        cohortsData?.some(
          (c) => c?.id === id && c?.name.toLowerCase().includes(term)
        )
      );
      return titleMatches || cohortsMatch;
    });
  }, [systemMessagesQuery.data, search, cohortsData]);

  const {
    column: sortColumn,
    direction: sortDirection,
    rows: filteredSystemMessages,
    toggle: handleSort,
  } = useSortable(filtered, { getValue: getSortValue });

  const handleDelete = (message: SystemMessageItem) => {
    if (!hasManagePermission) {
      return;
    }
    itemToDelete.current = message;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete.current) {
      deleteMutation.mutateAsync({ id: itemToDelete.current.id });
    }
  };

  const hasError = systemMessagesQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('systemMessages.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('systemMessages.description')}
        </p>
      </div>

      <TableToolbar
        canCreate={hasManagePermission}
        createLabel={t('systemMessages.create')}
        onCreate={() => {
          setSelectedItem(null);
          setDialogOpen(true);
        }}
        onRefresh={() => systemMessagesQuery.refetch()}
        onSearchChange={setSearch}
        refreshLabel={t('systemMessages.refresh')}
        search={search}
        searchPlaceholder={t('search')}
      />

      <QueryBoundary
        data={systemMessagesQuery.data}
        query={systemMessagesQuery}
      >
        {() => (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="w-full min-w-3xl">
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="w-[30%] cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center gap-2">
                      {t('systemMessages.title')}
                      <SortIcon
                        column="title"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    className="w-[15%] cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('validFrom')}
                  >
                    <div className="flex items-center gap-2">
                      {t('systemMessages.validFrom')}
                      <SortIcon
                        column="validFrom"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    className="w-[15%] cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('validUntil')}
                  >
                    <div className="flex items-center gap-2">
                      {t('systemMessages.validUntil')}
                      <SortIcon
                        column="validUntil"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </div>
                  </TableHead>
                  <TableHead
                    className="w-[20%] cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('cohorts')}
                  >
                    <div className="flex items-center gap-2">
                      {t('systemMessages.cohorts')}
                      <SortIcon
                        column="cohorts"
                        currentColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </div>
                  </TableHead>
                  {hasManagePermission && (
                    <TableHead className="w-[20%]">
                      {t('systemMessages.actions')}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSystemMessages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="font-medium">
                      {message.title}
                    </TableCell>
                    <TableCell>
                      {formatLocalizedDate(message.validFrom, i18n.language)}
                    </TableCell>
                    <TableCell>
                      {formatLocalizedDate(message.validUntil, i18n.language)}
                    </TableCell>
                    <TableCell>
                      {message.cohortIds.length > 0
                        ? cohortsData
                            ?.filter((c) =>
                              message.cohortIds.includes(c?.id || '')
                            )
                            .map((c) => c?.name)
                            .join(', ')
                        : t('systemMessages.noCohorts')}
                    </TableCell>
                    {hasManagePermission && (
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            aria-label={t('systemMessages.edit')}
                            onClick={() => {
                              setSelectedItem(message);
                              setDialogOpen(true);
                            }}
                            size="icon"
                            variant="outline"
                          >
                            <Pen className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label={t('systemMessages.deleteConfirm')}
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(message)}
                            size="icon"
                            variant="destructive"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!(filteredSystemMessages.length || hasError) && (
                  <TableRow>
                    <TableCell
                      className="text-muted-foreground"
                      colSpan={hasManagePermission ? 5 : 4}
                    >
                      {t('systemMessages.noSystemMessages')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      {hasManagePermission && (
        <>
          <NewsItemDialog
            item={selectedItem}
            // Remounting re-seeds the form's defaultValues, replacing the
            // reset-on-open effect that used to live in the dialog.
            key={`${dialogOpen ? 'open' : 'closed'}:${selectedItem?.id ?? 'new'}`}
            mode="system-messages"
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setSelectedItem(null);
              }
            }}
            open={dialogOpen}
          />
          <DeleteConfirmDialog
            description={t('systemMessages.deleteDescription')}
            onCancel={() => setDeleteDialogOpen(false)}
            onConfirm={confirmDelete}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                itemToDelete.current = null;
              }
            }}
            open={deleteDialogOpen}
            pending={deleteMutation.isPending}
            title={t('systemMessages.deleteConfirm')}
          />
        </>
      )}
    </div>
  );
}

function getSortValue(
  item: SystemMessageItem,
  sortColumn: 'title' | 'validFrom' | 'validUntil' | 'cohorts'
): string | number {
  switch (sortColumn) {
    case 'title':
      return item.title;
    case 'validFrom':
      return new Date(item.validFrom).getTime();
    case 'validUntil':
      return new Date(item.validUntil).getTime();
    case 'cohorts':
      return item.cohortIds.length;
    default:
      return '';
  }
}
