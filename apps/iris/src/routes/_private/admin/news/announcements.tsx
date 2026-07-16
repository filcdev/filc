import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AnnouncementsDialog } from '@/components/admin/announcements-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { SortIcon } from '@/components/util/sort-icon';
import { useHasPermission } from '@/hooks/use-has-permission';
import { useApiMutation, useApiQuery } from '@/utils/api';
import { authClient } from '@/utils/authentication';
import { formatLocalizedDate } from '@/utils/date-locale';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type AnnouncementApiResponse = InferResponseType<
  typeof api.news.announcements.$get
>;
type AnnouncementItem = NonNullable<AnnouncementApiResponse['data']>[number];

export const Route = createFileRoute('/_private/admin/news/announcements')({
  component: () => (
    <PermissionGuard permission="announcements:create">
      <AnnouncementsPage />
    </PermissionGuard>
  ),
});

function AnnouncementsPage() {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AnnouncementItem | null>(
    null
  );
  const [itemToDelete, setItemToDelete] = useState<AnnouncementItem | null>(
    null
  );
  const [sortColumn, setSortColumn] = useState<
    'title' | 'validFrom' | 'validUntil' | 'cohorts' | null
  >(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [showPast, setShowPast] = useState(false);

  const hasWritePermission = useHasPermission(
    'announcements:create',
    session?.user?.permissions
  );

  const announcementsQuery = useApiQuery<AnnouncementItem[]>(
    () =>
      api.news.announcements.$get({
        query: { includeExpired: 'true' },
      }),
    {
      queryKey: queryKeys.news.announcements(),
    }
  );

  const cohortsQuery = useApiQuery<
    NonNullable<InferResponseType<typeof api.cohort.index.$get>['data']>
  >(() => api.cohort.index.$get(), {
    enabled: hasWritePermission,
    queryKey: queryKeys.cohorts(),
  });

  const $create = api.news.announcements.$post;
  const createMutation = useApiMutation({
    mutationFn: (payload: InferRequestType<typeof $create>['json']) =>
      api.news.announcements.$post({
        json: payload,
      }),
    onError: (error: Error) => {
      toast.error(error.message || t('announcements.createError'));
    },
    onSuccess: () => {
      toast.success(t('announcements.createSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.news.announcements(),
      });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const updateMutation = useApiMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: InferRequestType<typeof $create>['json'];
    }) =>
      api.news.announcements[':id'].$patch({
        json: payload,
        param: { id },
      }),
    onError: (error: Error) => {
      toast.error(error.message || t('announcements.updateError'));
    },
    onSuccess: () => {
      toast.success(t('announcements.updateSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.news.announcements(),
      });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const deleteMutation = useApiMutation({
    mutationFn: (id: string) =>
      api.news.announcements[':id'].$delete({ param: { id } }),
    onError: (error: Error) => {
      toast.error(error.message || t('announcements.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('announcements.deleteSuccess'));
      queryClient.invalidateQueries({
        queryKey: queryKeys.news.announcements(),
      });
    },
  });

  const filteredAnnouncements = useMemo(() => {
    let list = announcementsQuery.data ?? [];
    const now = new Date();

    if (!showPast) {
      list = list.filter((ann) => new Date(ann.validUntil) >= now);
    }

    const term = search.trim().toLowerCase();

    if (term) {
      list = list.filter((ann) => {
        const titleMatches = (ann.title ?? '').toLowerCase().includes(term);
        const cohortsMatch = ann.cohortIds.some((id) =>
          cohortsQuery.data?.some(
            (c) => c?.id === id && c?.name.toLowerCase().includes(term)
          )
        );
        return titleMatches || cohortsMatch;
      });
    }

    if (sortColumn && sortDirection) {
      list = sortAnnouncements(
        list,
        sortColumn,
        sortDirection,
        cohortsQuery.data
      );
    }

    return list;
  }, [
    announcementsQuery.data,
    search,
    sortColumn,
    sortDirection,
    cohortsQuery.data,
    showPast,
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

  const handleDelete = (announcement: AnnouncementItem) => {
    if (!hasWritePermission) {
      return;
    }
    setItemToDelete(announcement);
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

  const isLoading = announcementsQuery.isLoading;
  const hasError = announcementsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('announcements.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('announcements.description')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          className="max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('search')}
          value={search}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            checked={showPast}
            id="show-past"
            onCheckedChange={(checked) => setShowPast(checked === true)}
          />
          <label
            className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor="show-past"
          >
            {t('announcements.showPast')}
          </label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={() => announcementsQuery.refetch()}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            {t('announcements.refresh')}
          </Button>
          {hasWritePermission && (
            <Button
              onClick={() => {
                setSelectedItem(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('announcements.create')}
            </Button>
          )}
        </div>
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>{t('announcements.loadError')}</AlertTitle>
          <AlertDescription>
            {(announcementsQuery.error as Error)?.message ||
              t('announcements.loadErrorMessage')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="w-full overflow-x-auto rounded-md border">
          <Table className="w-full min-w-3xl">
            <TableHeader>
              <TableRow>
                <TableHead
                  className="w-[30%] cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-2">
                    {t('announcements.title')}
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
                    {t('announcements.validFrom')}
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
                    {t('announcements.validUntil')}
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
                    {t('announcements.cohorts')}
                    <SortIcon
                      column="cohorts"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                {hasWritePermission && (
                  <TableHead className="w-[20%]">
                    {t('announcements.actions')}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAnnouncements.map((announcement) => (
                <TableRow key={announcement.id}>
                  <TableCell className="font-medium">
                    {announcement.title ??
                      t('announcements.untitled', 'Untitled')}
                  </TableCell>
                  <TableCell>
                    {formatLocalizedDate(announcement.validFrom, i18n.language)}
                  </TableCell>
                  <TableCell>
                    {formatLocalizedDate(
                      announcement.validUntil,
                      i18n.language
                    )}
                  </TableCell>
                  <TableCell>
                    {announcement.cohortIds.length > 0
                      ? cohortsQuery.data
                          ?.filter((c) =>
                            announcement.cohortIds.includes(c?.id || '')
                          )
                          .map((c) => c?.name)
                          .join(', ')
                      : t('announcements.noCohorts')}
                  </TableCell>
                  {hasWritePermission && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedItem(announcement);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(announcement)}
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
              {!(filteredAnnouncements.length || hasError) && (
                <TableRow>
                  <TableCell
                    className="text-muted-foreground"
                    colSpan={hasWritePermission ? 5 : 4}
                  >
                    {t('announcements.noAnnouncements')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {hasWritePermission && (
        <>
          <AnnouncementsDialog
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
                <DialogTitle>{t('announcements.deleteConfirm')}</DialogTitle>
                <DialogDescription>
                  {t('announcements.deleteDescription')}
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

function sortAnnouncements(
  list: AnnouncementItem[],
  column: 'title' | 'validFrom' | 'validUntil' | 'cohorts',
  direction: 'asc' | 'desc',
  _cohorts?: NonNullable<
    InferResponseType<typeof api.cohort.index.$get>['data']
  >
): AnnouncementItem[] {
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
  a: AnnouncementItem,
  sortColumn: 'title' | 'validFrom' | 'validUntil' | 'cohorts'
): string | number {
  switch (sortColumn) {
    case 'title':
      return a.title ?? '';
    case 'validFrom':
      return new Date(a.validFrom).getTime();
    case 'validUntil':
      return new Date(a.validUntil).getTime();
    case 'cohorts':
      return a.cohortIds.length;
    default:
      return '';
  }
}
