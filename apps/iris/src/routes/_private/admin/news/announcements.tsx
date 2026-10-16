import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Input } from '@filcdev/ui/components/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { createFileRoute } from '@tanstack/react-router';
import { ImageIcon, Plus, RefreshCw } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementsDialog } from '@/components/admin/announcements-dialog';
import { DeleteConfirmDialog } from '@/components/admin/delete-confirm-dialog';
import { RowActions } from '@/components/admin/row-actions';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type AnnouncementItem,
  type Cohort,
  useAnnouncements,
  useCohorts,
  useDeleteAnnouncement,
} from '@/hooks/news';
import { useHasPermission } from '@/hooks/use-has-permission';
import { type SortDirection, useSortable } from '@/hooks/use-sortable';
import { formatLocalizedDate } from '@/utils/date-locale';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/news/announcements')({
  component: () => (
    <PermissionGuard permission={permissions.announcementsCreate}>
      <AnnouncementsPage />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    Promise.all([
      prefetch(
        context.queryClient,
        orpc.news.announcements.list.queryOptions({
          input: {
            includeAll: 'true',
            includeExpired: 'true',
            includeKioskOnly: 'true',
          },
        })
      ),
      prefetch(context.queryClient, orpc.cohort.cohort.queryOptions()),
    ]),
});

function AnnouncementsPage() {
  const { i18n, t } = useTranslation();
  const showPastId = useId();
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AnnouncementItem | null>(
    null
  );
  const itemToDelete = useRef<AnnouncementItem | null>(null);
  const [showPast, setShowPast] = useState(false);

  const hasWritePermission = useHasPermission(
    permissions.announcementsCreate,
    session?.user?.permissions
  );

  const announcementsQuery = useAnnouncements();
  const { data: cohortsData } = useCohorts(hasWritePermission);

  const deleteMutation = useDeleteAnnouncement({
    onSaved: () => {
      setDeleteDialogOpen(false);
      itemToDelete.current = null;
    },
  });

  // The past/search filters stay here; only the ordering is delegated.
  const filtered = useMemo(() => {
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
          cohortsData?.some(
            (c) => c?.id === id && c?.name.toLowerCase().includes(term)
          )
        );
        return titleMatches || cohortsMatch;
      });
    }

    return list;
  }, [announcementsQuery.data, search, cohortsData, showPast]);

  const {
    column: sortColumn,
    direction: sortDirection,
    rows: filteredAnnouncements,
    toggle: handleSort,
  } = useSortable(filtered, { getValue: getSortValue });

  const handleDelete = (announcement: AnnouncementItem) => {
    if (!hasWritePermission) {
      return;
    }
    itemToDelete.current = announcement;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete.current) {
      deleteMutation.mutateAsync({ id: itemToDelete.current.id });
    }
  };

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
            id={showPastId}
            onCheckedChange={(checked) => setShowPast(checked === true)}
          />
          <label
            className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor={showPastId}
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

      <QueryBoundary data={announcementsQuery.data} query={announcementsQuery}>
        {() => (
          <AnnouncementsTable
            announcements={filteredAnnouncements}
            cohorts={cohortsData}
            hasError={hasError}
            hasWritePermission={hasWritePermission}
            isDeleting={deleteMutation.isPending}
            language={i18n.language}
            onDelete={handleDelete}
            onEdit={(announcement) => {
              setSelectedItem(announcement);
              setDialogOpen(true);
            }}
            onSort={handleSort}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
          />
        )}
      </QueryBoundary>

      {hasWritePermission && (
        <>
          <AnnouncementsDialog
            item={selectedItem}
            // Remounting re-seeds the form's defaultValues, replacing the
            // reset-on-open effect that used to live in the dialog.
            key={`${dialogOpen ? 'open' : 'closed'}:${selectedItem?.id ?? 'new'}`}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setSelectedItem(null);
              }
            }}
            open={dialogOpen}
          />
          <DeleteConfirmDialog
            description={t('announcements.deleteDescription')}
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
            title={t('announcements.deleteConfirm')}
          />
        </>
      )}
    </div>
  );
}

type AnnouncementsSortColumn = 'title' | 'validFrom' | 'validUntil' | 'cohorts';

type AnnouncementsTableProps = {
  announcements: AnnouncementItem[];
  cohorts: Cohort[] | undefined;
  hasError: boolean;
  hasWritePermission: boolean;
  isDeleting: boolean;
  language: string;
  onDelete: (announcement: AnnouncementItem) => void;
  onEdit: (announcement: AnnouncementItem) => void;
  onSort: (column: AnnouncementsSortColumn) => void;
  sortColumn: AnnouncementsSortColumn | null;
  sortDirection: SortDirection | null;
};

/** The announcements table: sortable headers, kiosk badges and row actions. */
function AnnouncementsTable({
  announcements,
  cohorts,
  hasError,
  hasWritePermission,
  isDeleting,
  language,
  onDelete,
  onEdit,
  onSort,
  sortColumn,
  sortDirection,
}: AnnouncementsTableProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full min-w-3xl">
        <TableHeader>
          <TableRow>
            <TableHead
              className="w-[25%] cursor-pointer select-none hover:bg-muted/50"
              onClick={() => onSort('title')}
            >
              <div className="flex items-center gap-2">
                {t('announcements.titleLabel')}
                <SortIcon
                  column="title"
                  currentColumn={sortColumn}
                  direction={sortDirection}
                />
              </div>
            </TableHead>
            <TableHead
              className="w-[15%] cursor-pointer select-none hover:bg-muted/50"
              onClick={() => onSort('validFrom')}
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
              onClick={() => onSort('validUntil')}
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
              className="w-[15%] cursor-pointer select-none hover:bg-muted/50"
              onClick={() => onSort('cohorts')}
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
            <TableHead className="w-[15%]">
              {t('announcements.kiosk')}
            </TableHead>
            {hasWritePermission && (
              <TableHead className="w-[20%]">
                {t('announcements.actions')}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {announcements.map((announcement) => (
            <TableRow key={announcement.id}>
              <TableCell className="font-medium">
                {announcement.title ?? t('announcements.untitled', 'Untitled')}
              </TableCell>
              <TableCell>
                {formatLocalizedDate(announcement.validFrom, language)}
              </TableCell>
              <TableCell>
                {formatLocalizedDate(announcement.validUntil, language)}
              </TableCell>
              <TableCell>
                {announcement.cohortIds.length > 0
                  ? cohorts
                      ?.filter((c) =>
                        announcement.cohortIds.includes(c?.id || '')
                      )
                      .map((c) => c?.name)
                      .join(', ')
                  : t('announcements.noCohorts')}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  {announcement.highlighted && (
                    <Badge variant="secondary">
                      {t('announcements.highlighted')}
                    </Badge>
                  )}
                  {announcement.kioskOnly && (
                    <Badge variant="outline">
                      {t('announcements.kioskOnly')}
                    </Badge>
                  )}
                  {announcement.imageKey && <ImageIcon className="h-4 w-4" />}
                  {!(
                    announcement.highlighted ||
                    announcement.imageKey ||
                    announcement.kioskOnly
                  ) && t('announcements.notOnKiosk')}
                </div>
              </TableCell>
              {hasWritePermission && (
                <TableCell>
                  <RowActions
                    isDeleting={isDeleting}
                    onDelete={() => onDelete(announcement)}
                    onEdit={() => onEdit(announcement)}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
          {!(announcements.length || hasError) && (
            <TableRow>
              <TableCell
                className="text-muted-foreground"
                colSpan={hasWritePermission ? 6 : 5}
              >
                {t('announcements.noAnnouncements')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
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
