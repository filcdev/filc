import { permissions } from '@filcdev/api/permissions';

import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  Calendar,
  CalendarCheck,
  CalendarClock,
  Eraser,
  FileUp,
  Pen,
  RefreshCw,
  Trash,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/components/admin/stat-card';
import { TimetableEditDialog } from '@/components/admin/timetable-edit-dialog';
import { TimetableImportDialog } from '@/components/admin/timetable-import-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  type TimetableRow,
  useCleanupOrphanedCohorts,
  useDeletePreview,
  useDeleteTimetable,
  useTimetables,
} from '@/hooks/timetables-admin';

export const Route = createFileRoute('/_private/admin/timetable/manage')({
  component: () => (
    <PermissionGuard permission={permissions.importTimetable}>
      <TimetableManagePage />
    </PermissionGuard>
  ),
});

type TimetableStatus = 'current' | 'past' | 'upcoming';

function getTimetableStatus(item: TimetableRow): TimetableStatus {
  const today = new Date().toISOString().slice(0, 10);
  const from = item.validFrom ?? null;
  const to = item.validTo ?? null;

  if (from && from > today) {
    return 'upcoming';
  }
  if (to && to < today) {
    return 'past';
  }
  return 'current';
}

const statusBadgeVariant: Record<
  TimetableStatus,
  'default' | 'secondary' | 'outline'
> = {
  current: 'default',
  past: 'secondary',
  upcoming: 'outline',
};

function DeletePreviewContent({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: Record<string, unknown> | null;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="py-2 text-destructive text-sm">
        {t('timetable.deleteError')}
      </p>
    );
  }

  const totals = data.totals as Record<string, number> | undefined;
  const isCurrent = data.isCurrentTimetable as boolean;
  if (!totals) {
    return (
      <p className="py-2 text-destructive text-sm">
        {t('timetable.deleteError')}
      </p>
    );
  }

  const items: Array<{ key: string; count: number }> = [
    { count: totals.lessonsDeleted ?? 0, key: 'lessonsDeleted' },
    { count: totals.substitutionsDeleted ?? 0, key: 'substitutionsDeleted' },
    { count: totals.movedLessonsDeleted ?? 0, key: 'movedLessonsDeleted' },
    { count: totals.orphanedCohorts ?? 0, key: 'orphanedCohorts' },
    { count: totals.survivingCohorts ?? 0, key: 'survivingCohorts' },
    { count: totals.danglingUsersCleaned ?? 0, key: 'danglingUsersCleaned' },
  ];

  return (
    <div className="space-y-3 py-2">
      {isCurrent && (
        <p className="font-semibold text-destructive text-sm">
          {t('timetable.deletePreview.currentTimetableWarning')}
        </p>
      )}
      <div className="space-y-1 text-sm">
        {items
          .filter((item) => item.count > 0)
          .map((item) => (
            <p key={item.key}>
              {t(`timetable.deletePreview.${item.key}`, { count: item.count })}
            </p>
          ))}
        {items.every((item) => item.count === 0) && (
          <p>{t('timetable.deletePreview.noImpact')}</p>
        )}
      </div>
    </div>
  );
}

function TimetableManagePage() {
  const { t } = useTranslation();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TimetableRow | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TimetableRow | null>(null);

  const timetablesQuery = useTimetables();

  const previewQuery = useDeletePreview(itemToDelete?.id);

  const deleteMutation = useDeleteTimetable({
    onSaved: () => {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
  });

  const cleanupMutation = useCleanupOrphanedCohorts();

  const formatDate = (date: string | null) => {
    if (!date) {
      return t('timetable.noDate');
    }
    return dayjs(date).format('YYYY-MM-DD');
  };

  const data = timetablesQuery.data ?? [];

  const stats = useMemo(
    () => ({
      current: data.filter((item) => getTimetableStatus(item) === 'current')
        .length,
      total: data.length,
      upcoming: data.filter((item) => getTimetableStatus(item) === 'upcoming')
        .length,
    }),
    [data]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('timetable.manage')}
        </h1>
        <p className="text-muted-foreground">
          {t('timetable.manageDescription')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          disabled={cleanupMutation.isPending}
          onClick={() => setCleanupDialogOpen(true)}
          size="sm"
          variant="outline"
        >
          <Eraser className="h-4 w-4" />
          {t('timetable.clean')}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => timetablesQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('timetable.refresh')}
          </Button>
          <Button onClick={() => setImportDialogOpen(true)}>
            <FileUp className="h-4 w-4" />
            {t('timetable.import')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Calendar className="text-primary" />}
          label={t('timetable.totalTimetables')}
          value={stats.total}
        />
        <StatCard
          icon={<CalendarCheck className="text-primary" />}
          label={t('timetable.currentTimetables')}
          value={stats.current}
        />
        <StatCard
          icon={<CalendarClock className="text-primary" />}
          label={t('timetable.upcomingTimetables')}
          value={stats.upcoming}
        />
      </div>

      {timetablesQuery.isLoading ? (
        <div className="space-y-2">
          {[...new Array(3)].map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton list
            <Skeleton className="h-12 w-full" key={i} />
          ))}
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-md border">
          <Table className="w-full min-w-3xl">
            <TableHeader>
              <TableRow>
                <TableHead>{t('timetable.nameLabel')}</TableHead>
                <TableHead>{t('timetable.validFromLabel')}</TableHead>
                <TableHead>{t('timetable.validToLabel')}</TableHead>
                <TableHead>{t('timetable.statusLabel')}</TableHead>
                <TableHead>{t('substitution.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => {
                const status = getTimetableStatus(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{formatDate(item.validFrom)}</TableCell>
                    <TableCell>{formatDate(item.validTo)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[status]}>
                        {t(`timetable.status.${status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          aria-label={`${t('timetable.editTitle')}: ${item.name}`}
                          onClick={() => {
                            setSelectedItem(item);
                            setEditDialogOpen(true);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          aria-label={`${t('timetable.deleteConfirm')}: ${item.name}`}
                          onClick={() => {
                            setItemToDelete(item);
                            setDeleteDialogOpen(true);
                          }}
                          size="sm"
                          variant="destructive"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TimetableImportDialog
        onOpenChange={setImportDialogOpen}
        open={importDialogOpen}
      />

      <TimetableEditDialog
        item={selectedItem}
        onOpenChange={setEditDialogOpen}
        open={editDialogOpen}
      />

      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('timetable.deletePreview.title')}</DialogTitle>
            <DialogDescription>
              {t('timetable.deletePreview.description', {
                name: itemToDelete?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DeletePreviewContent
            data={previewQuery.data as Record<string, unknown> | null}
            isLoading={previewQuery.isLoading}
          />
          <DialogFooter>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={
                deleteMutation.isPending ||
                (previewQuery.data?.isCurrentTimetable ?? true)
              }
              onClick={() => {
                if (itemToDelete) {
                  deleteMutation.mutate(itemToDelete.id);
                }
              }}
              variant="destructive"
            >
              {deleteMutation.isPending
                ? t('common.deleting')
                : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setCleanupDialogOpen} open={cleanupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('timetable.cleanupConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('timetable.cleanupConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setCleanupDialogOpen(false)}
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={cleanupMutation.isPending}
              onClick={() => {
                cleanupMutation.mutate();
                setCleanupDialogOpen(false);
              }}
              variant="destructive"
            >
              {cleanupMutation.isPending
                ? t('common.deleting')
                : t('timetable.clean')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
