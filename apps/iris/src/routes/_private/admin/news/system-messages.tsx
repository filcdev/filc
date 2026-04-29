import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Pen,
  Plus,
  RefreshCw,
  Trash,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SystemMessagesDialog } from '@/components/admin/system-messages-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionGuard } from '@/components/util/permission-guard';
import { authClient } from '@/utils/authentication';
import { formatLocalizedDate } from '@/utils/date-locale';
import { api } from '@/utils/hc';

type SystemMessageApiResponse = InferResponseType<
  (typeof api.news)['system-messages']['$get']
>;
type SystemMessageItem = NonNullable<SystemMessageApiResponse['data']>[number];

export const Route = createFileRoute('/_private/admin/news/system-messages')({
  component: () => (
    <PermissionGuard permission="system-messages:manage">
      <SystemMessagesPage />
    </PermissionGuard>
  ),
});

function SortIcon({
  column,
  currentColumn,
  direction,
}: {
  column: 'title' | 'validFrom' | 'validUntil' | 'cohorts';
  currentColumn: 'title' | 'validFrom' | 'validUntil' | 'cohorts' | null;
  direction: 'asc' | 'desc' | null;
}) {
  if (currentColumn !== column) {
    return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  }
  return direction === 'asc' ? (
    <ArrowUp className="h-4 w-4" />
  ) : (
    <ArrowDown className="h-4 w-4" />
  );
}

function SystemMessagesPage() {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
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
    'system-messages:manage',
    session?.user?.permissions
  );

  const systemMessagesQuery = useQuery({
    enabled: hasManagePermission,
    queryFn: async (): Promise<SystemMessageItem[]> => {
      const res = await parseResponse(
        api.news['system-messages'].$get({
          query: {},
        })
      );
      if (!res.success) {
        throw new Error('Failed to load system messages');
      }
      return res.data as SystemMessageItem[];
    },
    queryKey: ['admin-system-messages'],
  });

  const cohortsQuery = useQuery({
    enabled: hasManagePermission,
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return res.data;
    },
    queryKey: ['cohorts'],
  });

  const $create = api.news['system-messages'].$post;
  const createMutation = useMutation<
    InferResponseType<typeof $create>,
    Error,
    InferRequestType<typeof $create>['json']
  >({
    mutationFn: async (payload) => {
      const res = await parseResponse(
        api.news['system-messages'].$post({
          json: payload,
        })
      );
      if (!res.success) {
        throw new Error('Failed to create system message');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('systemMessages.createError'));
    },
    onSuccess: () => {
      toast.success(t('systemMessages.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin-system-messages'] });
      queryClient.invalidateQueries({ queryKey: ['system-messages-banner'] });
      queryClient.invalidateQueries({ queryKey: ['system-messages-panel'] });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: InferRequestType<typeof $create>['json'];
    }) => {
      const res = await parseResponse(
        api.news['system-messages'][':id'].$patch({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update system message');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('systemMessages.updateError'));
    },
    onSuccess: () => {
      toast.success(t('systemMessages.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin-system-messages'] });
      queryClient.invalidateQueries({ queryKey: ['system-messages-banner'] });
      queryClient.invalidateQueries({ queryKey: ['system-messages-panel'] });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      parseResponse(
        api.news['system-messages'][':id'].$delete({ param: { id } })
      ),
    onError: (error: Error) => {
      toast.error(error.message || t('systemMessages.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('systemMessages.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['admin-system-messages'] });
      queryClient.invalidateQueries({ queryKey: ['system-messages-banner'] });
      queryClient.invalidateQueries({ queryKey: ['system-messages-panel'] });
    },
  });

  const filteredSystemMessages = useMemo(() => {
    let list = systemMessagesQuery.data ?? [];
    const term = search.trim().toLowerCase();

    if (term) {
      list = list.filter((message) => {
        const titleMatches = message.title.toLowerCase().includes(term);
        const cohortsMatch = message.cohortIds.some((id) =>
          cohortsQuery.data?.some(
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
    cohortsQuery.data,
  ]);

  const handleSave = async (
    payload: InferRequestType<typeof $create>['json']
  ) => {
    if (selectedItem) {
      await updateMutation.mutateAsync({
        id: selectedItem.id,
        payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

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

  const confirmDelete = async () => {
    if (!itemToDelete) {
      return;
    }
    await deleteMutation.mutateAsync(itemToDelete.id);
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const isLoading = systemMessagesQuery.isLoading;
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

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>{t('systemMessages.loadError')}</AlertTitle>
          <AlertDescription>
            {(systemMessagesQuery.error as Error)?.message ||
              t('systemMessages.loadErrorMessage')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
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
                  <TableCell className="font-medium">{message.title}</TableCell>
                  <TableCell>
                    {formatLocalizedDate(message.validFrom, i18n.language)}
                  </TableCell>
                  <TableCell>
                    {formatLocalizedDate(message.validUntil, i18n.language)}
                  </TableCell>
                  <TableCell>
                    {message.cohortIds.length > 0
                      ? cohortsQuery.data
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

      {hasManagePermission && (
        <>
          <SystemMessagesDialog
            cohorts={cohortsQuery.data?.filter((c) => c !== undefined) ?? []}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            item={selectedItem}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setSelectedItem(null);
              }
            }}
            onSubmit={handleSave}
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

function useHasPermission(permission: string, permissions?: string[] | null) {
  if (!permissions) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(permission);
}
