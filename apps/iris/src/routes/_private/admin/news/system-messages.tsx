import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NewsItemDialog } from '@/components/admin/news-item-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { authClient } from '@/utils/authentication';
import { formatLocalizedDate } from '@/utils/date-locale';

export const Route = createFileRoute('/_private/admin/news/system-messages')({
  component: () => (
    <PermissionGuard permission={permissions.systemMessagesManage}>
      <SystemMessagesPage />
    </PermissionGuard>
  ),
});

function SystemMessagesPage() {
  const { i18n, t } = useTranslation();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SystemMessageItem | null>(
    null
  );
  const [itemToDelete, setItemToDelete] = useState<SystemMessageItem | null>(
    null
  );
  const [sortColumn, setSortColumn] = useState<
    'title' | 'validFrom' | 'validUntil' | 'cohorts' | null
  >(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );

  const hasManagePermission = useHasPermission(
    permissions.systemMessagesManage,
    session?.user?.permissions
  );

  const systemMessagesQuery = useAdminSystemMessages(hasManagePermission);
  const { data: cohortsData } = useCohorts(hasManagePermission);

  const deleteMutation = useDeleteSystemMessage({
    onSaved: () => {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
  });

  const filteredSystemMessages = useMemo(() => {
    let list = systemMessagesQuery.data ?? [];
    const term = search.trim().toLowerCase();

    if (term) {
      list = list.filter((message) => {
        const titleMatches = message.title.toLowerCase().includes(term);
        const cohortsMatch = message.cohortIds.some((id) =>
          cohortsData?.some(
            (c) => c?.id === id && c?.name.toLowerCase().includes(term)
          )
        );
        return titleMatches || cohortsMatch;
      });
    }

    if (sortColumn && sortDirection) {
      list = sortSystemMessages(list, sortColumn, sortDirection);
    }

    return list;
  }, [
    systemMessagesQuery.data,
    search,
    sortColumn,
    sortDirection,
    cohortsData,
  ]);

  const handleSort = (
    column: 'title' | 'validFrom' | 'validUntil' | 'cohorts'
  ) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleDelete = (message: SystemMessageItem) => {
    if (!hasManagePermission) {
      return;
    }
    setItemToDelete(message);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutateAsync(itemToDelete.id);
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

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('search')}
          value={search}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={() => systemMessagesQuery.refetch()}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            {t('systemMessages.refresh')}
          </Button>
          {hasManagePermission && (
            <Button
              onClick={() => {
                setSelectedItem(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('systemMessages.create')}
            </Button>
          )}
        </div>
      </div>

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
            mode="system-messages"
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setSelectedItem(null);
              }
            }}
            open={dialogOpen}
          />
          <Dialog
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                setItemToDelete(null);
              }
            }}
            open={deleteDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('systemMessages.deleteConfirm')}</DialogTitle>
                <DialogDescription>
                  {t('systemMessages.deleteDescription')}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  onClick={() => setDeleteDialogOpen(false)}
                  variant="outline"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  disabled={deleteMutation.isPending}
                  onClick={confirmDelete}
                  variant="destructive"
                >
                  {deleteMutation.isPending
                    ? t('common.deleting')
                    : t('common.delete')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function sortSystemMessages(
  list: SystemMessageItem[],
  column: 'title' | 'validFrom' | 'validUntil' | 'cohorts',
  direction: 'asc' | 'desc'
): SystemMessageItem[] {
  return [...list].sort((a, b) => {
    const aVal = getSortValue(a, column);
    const bVal = getSortValue(b, column);

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const comparison = aVal.localeCompare(bVal);
      return direction === 'asc' ? comparison : -comparison;
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });
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
