import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { type InferResponseType, parseResponse } from 'hono/client';
import { Pen, Trash } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { TimetableEditDialog } from '@/components/admin/timetable-edit-dialog';
import type { TimetableItem } from '@/components/timetable/types';
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
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

export const Route = createFileRoute('/_private/admin/timetable/manage')({
  component: () => (
    <PermissionGuard permission="import:timetable">
      <TimetableManagePage />
    </PermissionGuard>
  ),
});

type TimetableApiResponse = InferResponseType<
  typeof api.timetable.timetables.$get
>;
type TimetableRow = NonNullable<TimetableApiResponse['data']>[number];

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

function TimetableManagePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TimetableRow | null>(null);
  const [itemToDelete, setItemToDelete] = useState<TimetableRow | null>(null);

  const timetablesQuery = useQuery({
    queryFn: async (): Promise<TimetableRow[]> => {
      const res = await parseResponse(api.timetable.timetables.$get());
      if (!res.success) {
        throw new Error('Failed to load timetables');
      }
      return (res.data ?? []) as TimetableRow[];
    },
    queryKey: queryKeys.timetables(),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { validFrom?: string; validTo?: string | null };
    }) => {
      const res = await parseResponse(
        api.timetable.timetables[':id'].$patch({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update timetable');
      }
      return res;
    },
    onError: () => {
      toast.error(t('timetable.updateError'));
    },
    onSuccess: () => {
      toast.success(t('timetable.updateSuccess'));
      setEditDialogOpen(false);
      setSelectedItem(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.timetables() });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.timetable.timetables[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete timetable');
      }
      return res;
    },
    onError: () => {
      toast.error(t('timetable.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('timetable.deleteSuccess'));
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.timetables() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.lessons() });
    },
  });

  const handleEditSubmit = async (payload: {
    validFrom?: string;
    validTo?: string | null;
  }) => {
    if (!selectedItem) {
      return;
    }
    await updateMutation.mutateAsync({ id: selectedItem.id, payload });
  };

  const formatDate = (date: string | null) => {
    if (!date) {
      return t('timetable.noDate');
    }
    return dayjs(date).format('YYYY-MM-DD');
  };

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('timetable.manage')}
        </h1>
        <p className="text-muted-foreground">
          {t('timetable.manageDescription')}
        </p>
      </div>

      {timetablesQuery.isLoading ? (
        <div className="space-y-2">
          {[...new Array(3)].map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton list
            <Skeleton className="h-12 w-full" key={i} />
          ))}
        </div>
      ) : (
        <Table>
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
            {(timetablesQuery.data ?? []).map((item) => {
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
      )}

      <TimetableEditDialog
        isSubmitting={updateMutation.isPending}
        item={selectedItem as TimetableItem | null}
        onOpenChange={setEditDialogOpen}
        onSubmit={handleEditSubmit}
        open={editDialogOpen}
      />

      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('timetable.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('timetable.deleteDescription', {
                name: itemToDelete?.name ?? '',
              })}
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
    </div>
  );
}
