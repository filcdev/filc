import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
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
import { SubstitutionDialog } from '@/components/admin/substitution-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { authClient } from '@/utils/authentication';
import { formatLocalizedDate } from '@/utils/date-locale';
import { api } from '@/utils/hc';

type SubstitutionApiResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;
type SubstitutionItem = NonNullable<SubstitutionApiResponse['data']>[number];
type Teacher = NonNullable<SubstitutionItem['teacher']>;

export const Route = createFileRoute('/_private/admin/timetable/substitutions')(
  {
    component: () => (
      <PermissionGuard permission="substitution:create">
        <SubstitutionsPage />
      </PermissionGuard>
    ),
  }
);

function SortIcon({
  column,
  currentColumn,
  direction,
}: {
  column: 'date' | 'teacher' | 'lessons' | 'cohorts';
  currentColumn: 'date' | 'teacher' | 'lessons' | 'cohorts' | null;
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

function SubstitutionsPage() {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SubstitutionItem | null>(
    null
  );
  const [itemToDelete, setItemToDelete] = useState<SubstitutionItem | null>(
    null
  );
  const [sortColumn, setSortColumn] = useState<
    'date' | 'teacher' | 'lessons' | 'cohorts' | null
  >(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [showPast, setShowPast] = useState(false);

  const hasWritePermission = useHasPermission(
    'substitution:create',
    session?.user?.permissions
  );

  const substitutionsQuery = useQuery({
    queryFn: async (): Promise<SubstitutionItem[]> => {
      const res = await parseResponse(api.timetable.substitutions.$get());
      if (!res.success) {
        throw new Error('Failed to load substitutions');
      }
      return res.data as SubstitutionItem[];
    },
    queryKey: ['substitutions'],
  });

  const teachersQuery = useQuery({
    enabled: hasWritePermission,
    queryFn: async (): Promise<Teacher[]> => {
      const res = await parseResponse(api.timetable.teachers.getAll.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load teachers');
      }
      return res.data as Teacher[];
    },
    queryKey: ['teachers'],
  });

  const $create = api.timetable.substitutions.$post;
  const createMutation = useMutation<
    InferResponseType<typeof $create>,
    Error,
    InferRequestType<typeof $create>['json']
  >({
    mutationFn: async (payload) => {
      const res = await parseResponse(
        api.timetable.substitutions.$post({
          json: payload,
        })
      );
      if (!res.success) {
        throw new Error('Failed to create substitution');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.createError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
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
        api.timetable.substitutions[':id'].$put({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update substitution');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.updateError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      parseResponse(
        api.timetable.substitutions[':id'].$delete({ param: { id } })
      ),
    onError: (error: Error) => {
      toast.error(error.message || t('substitution.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('substitution.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
    },
  });

  const filteredSubstitutions = useMemo(() => {
    let list = substitutionsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    const today = dayjs().startOf('day');

    // Dátum szerinti szűrés (csak mai és jövőbeli, ha showPast false)
    if (!showPast) {
      list = list.filter((sub) => {
        const subDate = dayjs(sub.substitution.date).startOf('day');
        return !subDate.isBefore(today);
      });
    }

    // Keresés szerinti szűrés
    if (term) {
      list = list.filter((sub) => {
        const teacherName = sub.teacher
          ? `${sub.teacher.firstName} ${sub.teacher.lastName}`.toLowerCase()
          : '';
        const lessons = sub.lessons.filter(
          (l) => l !== null && l !== undefined
        );

        const lessonSubjects = lessons
          .map((l) => l.subject?.name ?? '')
          .join(' ')
          .toLowerCase();
        const cohorts = lessons
          .flatMap((l) => l.cohorts)
          .join(' ')
          .toLowerCase();
        return (
          sub.substitution.date.includes(term) ||
          teacherName.includes(term) ||
          lessonSubjects.includes(term) ||
          cohorts.includes(term)
        );
      });
    }

    // Rendezés
    if (sortColumn && sortDirection) {
      list = [...list].sort((a, b) => {
        const aVal = getSortValue(a, sortColumn);
        const bVal = getSortValue(b, sortColumn);

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comparison = aVal.localeCompare(bVal);
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        return 0;
      });
    }

    return list;
  }, [substitutionsQuery.data, search, sortColumn, sortDirection, showPast]);

  const handleSave = async (
    payload: InferRequestType<typeof $create>['json']
  ) => {
    if (selectedItem) {
      await updateMutation.mutateAsync({
        id: selectedItem.substitution.id,
        payload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleSort = (column: 'date' | 'teacher' | 'lessons' | 'cohorts') => {
    if (sortColumn === column) {
      // Ugyanaz az oszlop: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      // Új oszlop: kezdjük asc-vel
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleDelete = (sub: SubstitutionItem) => {
    if (!hasWritePermission) {
      return;
    }
    setItemToDelete(sub);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) {
      return;
    }
    await deleteMutation.mutateAsync(itemToDelete.substitution.id);
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const isLoading = substitutionsQuery.isLoading;
  const hasError = substitutionsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('substitution.title')}
        </h1>
        <p className="text-muted-foreground">{t('substitution.description')}</p>
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
            {t('substitution.showPast')}
          </label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            onClick={() => substitutionsQuery.refetch()}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            {t('substitution.refresh')}
          </Button>
          {hasWritePermission && (
            <Button
              onClick={() => {
                setSelectedItem(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('substitution.create')}
            </Button>
          )}
        </div>
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>{t('substitution.loadError')}</AlertTitle>
          <AlertDescription>
            {(substitutionsQuery.error as Error)?.message ??
              t('substitution.loadErrorMessage')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-2">
                    {t('substitution.date')}
                    <SortIcon
                      column="date"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('teacher')}
                >
                  <div className="flex items-center gap-2">
                    {t('substitution.substituteTeacher')}
                    <SortIcon
                      column="teacher"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('lessons')}
                >
                  <div className="flex items-center gap-2">
                    {t('substitution.affectedLessons')}
                    <SortIcon
                      column="lessons"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('cohorts')}
                >
                  <div className="flex items-center gap-2">
                    {t('substitution.cohorts')}
                    <SortIcon
                      column="cohorts"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                {hasWritePermission && (
                  <TableHead>{t('substitution.actions')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubstitutions.map((sub) => (
                <TableRow key={sub.substitution.id}>
                  <TableCell className="font-medium">
                    {formatLocalizedDate(sub.substitution.date, i18n.language)}
                  </TableCell>
                  <TableCell>
                    {sub.teacher ? (
                      `${sub.teacher.firstName} ${sub.teacher.lastName}`
                    ) : (
                      <Badge variant="destructive">
                        {t('substitution.cancelled')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {sub.lessons.length > 0
                      ? sub.lessons
                          .filter((l) => l !== null && l !== undefined)
                          .map(
                            (l) =>
                              `${l.subject?.short ?? '?'} P${l.period?.period ?? '?'}`
                          )
                          .join(', ')
                      : t('substitution.noLessons')}
                  </TableCell>
                  <TableCell>
                    {Array.from(
                      new Set(
                        sub.lessons
                          .filter((l) => l !== null && l !== undefined)
                          .flatMap((l) => l.cohorts)
                      )
                    ).join(', ') || '-'}
                  </TableCell>
                  {hasWritePermission && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedItem(sub);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(sub)}
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
              {!(filteredSubstitutions.length || hasError) && (
                <TableRow>
                  <TableCell
                    className="text-muted-foreground"
                    colSpan={hasWritePermission ? 5 : 4}
                  >
                    {t('substitution.noSubstitutions')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {hasWritePermission && (
        <>
          <SubstitutionDialog
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
            teachers={teachersQuery.data ?? []}
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
                <DialogTitle>{t('substitution.deleteConfirm')}</DialogTitle>
                <DialogDescription>
                  {t('substitution.deleteDescription')}
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

function useHasPermission(permission: string, permissions?: string[] | null) {
  if (!permissions) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(permission);
}
function getSortValue(
  a: SubstitutionItem,
  sortColumn: 'date' | 'teacher' | 'lessons' | 'cohorts'
): string {
  switch (sortColumn) {
    case 'date':
      return a.substitution.date;
    case 'teacher':
      return a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}` : '';
    case 'lessons':
      return a.lessons
        .filter((l) => l !== null && l !== undefined)
        .map((l) => l.subject?.short ?? '')
        .join(' ');
    case 'cohorts':
      return Array.from(
        new Set(
          a.lessons
            .filter((l) => l !== null && l !== undefined)
            .flatMap((l) => l.cohorts)
        )
      ).join(' ');
    default:
      return '';
  }
}
