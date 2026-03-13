import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { type InferResponseType, parseResponse } from 'hono/client';
import { Calendar, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { api } from '@/utils/hc';

export const Route = createFileRoute('/_private/admin/timetable/manage')({
  component: RouteComponent,
});

type TimetableItem = {
  id: string;
  name: string;
  validFrom: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function RouteComponent() {
  return (
    <PermissionGuard permission="import:timetable">
      <TimetableManagePage />
    </PermissionGuard>
  );
}

const dateToYYYYMMDD = (date: Date): string =>
  date.toLocaleDateString('en-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

function TimetableManagePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const timetablesQuery = useQuery({
    queryFn: async (): Promise<TimetableItem[]> => {
      const res = await parseResponse(api.timetable.timetables.$get());
      if (!res.success) {
        throw new Error('Failed to load timetables');
      }
      return (res.data ?? []) as TimetableItem[];
    },
    queryKey: ['timetables'],
  });

  const [editTarget, setEditTarget] = useState<TimetableItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editValidFrom, setEditValidFrom] = useState<Date | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<TimetableItem | null>(null);

  const $patch = api.timetable.timetables[':id'].$patch;
  const updateMutation = useMutation<
    InferResponseType<typeof $patch>,
    Error,
    { id: string; name: string; validFrom: string }
  >({
    mutationFn: async ({ id, name, validFrom }) => {
      const res = await parseResponse(
        api.timetable.timetables[':id'].$patch({
          json: { name, validFrom },
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
      setEditTarget(null);
      setEditName('');
      setEditValidFrom(undefined);
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
    },
  });

  const $delete = api.timetable.timetables[':id'].$delete;
  const deleteMutation = useMutation<
    InferResponseType<typeof $delete>,
    Error,
    string
  >({
    mutationFn: async (id) => {
      const res = await parseResponse(
        api.timetable.timetables[':id'].$delete({
          param: { id },
        })
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
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['timetables'] });
      queryClient.invalidateQueries({ queryKey: ['cohorts'] });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });

  const startEdit = (tt: TimetableItem) => {
    setEditTarget(tt);
    setEditName(tt.name);
    setEditValidFrom(tt.validFrom ? new Date(tt.validFrom) : undefined);
  };

  const saveEdit = () => {
    if (!(editTarget && editName.trim())) {
      return;
    }
    updateMutation.mutate({
      id: editTarget.id,
      name: editName.trim(),
      validFrom: editValidFrom ? dateToYYYYMMDD(editValidFrom) : '',
    });
  };

  const cancelEdit = () => {
    setEditTarget(null);
    setEditName('');
    setEditValidFrom(undefined);
  };

  const today = dateToYYYYMMDD(new Date());

  // Sort by validFrom descending
  const sortedTimetables = [...(timetablesQuery.data ?? [])].sort((a, b) => {
    if (!(a.validFrom || b.validFrom)) {
      return 0;
    }
    if (!a.validFrom) {
      return 1;
    }
    if (!b.validFrom) {
      return -1;
    }
    return b.validFrom.localeCompare(a.validFrom);
  });

  // Determine current timetable
  const currentTimetable = sortedTimetables.find(
    (tt) => tt.validFrom && tt.validFrom <= today
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) {
      return '—';
    }
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderContent = () => {
    if (timetablesQuery.isLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      );
    }

    if (sortedTimetables.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Calendar className="mb-4 h-12 w-12" />
          <p>{t('timetable.noTimetables')}</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('timetable.importNameLabel')}</TableHead>
            <TableHead>{t('timetable.validFromLabel')}</TableHead>
            <TableHead className="text-right">
              {t('substitution.actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTimetables.map((tt) => (
            <TableRow key={tt.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{tt.name}</span>
                  {tt.id === currentTimetable?.id && (
                    <Badge variant="secondary">
                      {t('timetable.activeTimetable')}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatDate(tt.validFrom)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => startEdit(tt)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      {t('timetable.editTimetable')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteTarget(tt)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('timetable.deleteTimetable')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
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

      <Card>
        <CardHeader>
          <CardTitle>{t('timetable.allTimetables')}</CardTitle>
          <CardDescription>
            {t('timetable.allTimetablesDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            cancelEdit();
          }
        }}
        open={!!editTarget}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('timetable.editTimetable')}</DialogTitle>
            <DialogDescription>
              {t('timetable.allTimetablesDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              autoFocus
              onChange={(event) => setEditName(event.target.value)}
              placeholder={t('timetable.importNamePlaceholder')}
              value={editName}
            />
            <DatePicker
              date={editValidFrom}
              onDateChange={setEditValidFrom}
              placeholder={t('timetable.validFromPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={updateMutation.isPending}
              onClick={cancelEdit}
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={updateMutation.isPending || !editName.trim()}
              onClick={saveEdit}
            >
              {updateMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={!!deleteTarget}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('timetable.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('timetable.deleteDescription', {
                name: deleteTarget?.name,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteTarget(null)}
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate(deleteTarget.id);
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
