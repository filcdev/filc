import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@filcdev/ui/components/alert';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Checkbox } from '@filcdev/ui/components/checkbox';
import { Input } from '@filcdev/ui/components/input';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { Plus, RefreshCw } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteConfirmDialog } from '@/components/admin/delete-confirm-dialog';
import { RowActions } from '@/components/admin/row-actions';
import { SubstitutionDialog } from '@/components/admin/substitution-dialog';
import { SubstitutionExportButton } from '@/components/admin/substitution-export';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/date-range-picker';
import { PermissionGuard } from '@/components/util/permission-guard';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type SubstitutionItem,
  useDeleteSubstitution,
  useSubstitutions,
} from '@/hooks/substitutions';
import { useHasPermission } from '@/hooks/use-has-permission';
import { type SortDirection, useSortable } from '@/hooks/use-sortable';
import { formatLocalizedDate } from '@/utils/date-locale';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/timetable/substitutions')(
  {
    component: () => (
      <PermissionGuard permission={permissions.substitutionCreate}>
        <SubstitutionsPage />
      </PermissionGuard>
    ),
    loader: ({ context }) =>
      Promise.all([
        prefetch(
          context.queryClient,
          orpc.timetable.substitutions.list.queryOptions()
        ),
        prefetch(
          context.queryClient,
          orpc.timetable.teachers.getAll.queryOptions()
        ),
      ]),
  }
);

function SubstitutionsPage() {
  const { i18n, t } = useTranslation();
  const showPastId = useId();
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SubstitutionItem | null>(
    null
  );
  const itemToDelete = useRef<SubstitutionItem | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({});

  const hasWritePermission = useHasPermission(
    permissions.substitutionCreate,
    session?.user?.permissions
  );

  const substitutionsQuery = useSubstitutions();
  const deleteMutation = useDeleteSubstitution({
    onSaved: () => {
      setDeleteDialogOpen(false);
      itemToDelete.current = null;
    },
  });

  // The date/search filters stay here; only the ordering is delegated.
  const filtered = useMemo(() => {
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
        const replacedTeachers = sub.lessons
          .filter((l) => l !== null && l !== undefined)
          .flatMap((l) => l.teachers.map((teacher) => teacher.name))
          .join(' ')
          .toLowerCase();
        const lessons = sub.lessons.filter(
          (l) => l !== null && l !== undefined
        );

        const lessonSubjects = lessons
          .map((l) => l.subject?.name ?? '')
          .join(' ')
          .toLowerCase();
        const cohorts = lessons
          .flatMap((l) => l.cohorts.map((c) => c.name))
          .join(' ')
          .toLowerCase();
        return (
          sub.substitution.date.toISOString().includes(term) ||
          teacherName.includes(term) ||
          replacedTeachers.includes(term) ||
          lessonSubjects.includes(term) ||
          cohorts.includes(term)
        );
      });
    }

    return list;
  }, [substitutionsQuery.data, search, showPast]);

  const {
    column: sortColumn,
    direction: sortDirection,
    rows: filteredSubstitutions,
    toggle: handleSort,
  } = useSortable(filtered, { getValue: getSortValue });

  const handleDelete = (sub: SubstitutionItem) => {
    if (!hasWritePermission) {
      return;
    }
    itemToDelete.current = sub;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete.current) {
      deleteMutation.mutateAsync({ id: itemToDelete.current.substitution.id });
    }
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          className="w-full sm:max-w-sm"
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
            {t('substitution.showPast')}
          </label>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <div className="w-fit">
            <DateRangePicker onChange={setDateRange} value={dateRange} />
          </div>
          <SubstitutionExportButton dateRange={dateRange} />
          <Button
            aria-label={t('substitution.refresh')}
            onClick={() => substitutionsQuery.refetch()}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t('substitution.refresh')}
            </span>
          </Button>
          {hasWritePermission && (
            <Button
              aria-label={t('substitution.create')}
              onClick={() => {
                setSelectedItem(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t('substitution.create')}
              </span>
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
        <SubstitutionsTable
          hasError={hasError}
          hasWritePermission={hasWritePermission}
          isDeleting={deleteMutation.isPending}
          language={i18n.language}
          onDelete={handleDelete}
          onEdit={(sub) => {
            setSelectedItem(sub);
            setDialogOpen(true);
          }}
          onSort={handleSort}
          rows={filteredSubstitutions}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
        />
      )}

      {hasWritePermission && dialogOpen && (
        <SubstitutionDialog
          item={selectedItem}
          // Remounting re-seeds the form's defaultValues, replacing the
          // reset-on-open effect that used to live in the dialog.
          key={selectedItem?.substitution.id ?? 'new'}
          manual={manualMode}
          onManualChange={setManualMode}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedItem(null);
              setManualMode(false);
            }
          }}
          open={dialogOpen}
        />
      )}

      {hasWritePermission && (
        <DeleteConfirmDialog
          description={t('substitution.deleteDescription')}
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
          title={t('substitution.deleteConfirm')}
        />
      )}
    </div>
  );
}

type SubstitutionSortColumn =
  | 'date'
  | 'teacher'
  | 'lessons'
  | 'cohorts'
  | 'replacedTeacher';

type SubstitutionsTableProps = {
  hasError: boolean;
  hasWritePermission: boolean;
  isDeleting: boolean;
  language: string;
  onDelete: (sub: SubstitutionItem) => void;
  onEdit: (sub: SubstitutionItem) => void;
  onSort: (column: SubstitutionSortColumn) => void;
  rows: SubstitutionItem[];
  sortColumn: SubstitutionSortColumn | null;
  sortDirection: SortDirection | null;
};

/** The substitutions table: sortable headers, affected lessons and cohorts. */
function SubstitutionsTable({
  hasError,
  hasWritePermission,
  isDeleting,
  language,
  onDelete,
  onEdit,
  onSort,
  rows,
  sortColumn,
  sortDirection,
}: SubstitutionsTableProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full min-w-3xl">
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none hover:bg-muted/50"
              onClick={() => onSort('date')}
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
              onClick={() => onSort('replacedTeacher')}
            >
              <div className="flex items-center gap-2">
                {t('substitution.missingTeacher')}
                <SortIcon
                  column="replacedTeacher"
                  currentColumn={sortColumn}
                  direction={sortDirection}
                />
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer select-none hover:bg-muted/50"
              onClick={() => onSort('teacher')}
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
              onClick={() => onSort('lessons')}
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
              onClick={() => onSort('cohorts')}
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
          {rows.map((sub) => (
            <TableRow key={sub.substitution.id}>
              <TableCell className="font-medium">
                {formatLocalizedDate(sub.substitution.date, language)}
              </TableCell>
              <TableCell className="truncate">
                {(() => {
                  const replacedTeachers = Array.from(
                    new Set(
                      sub.lessons
                        .filter((l) => l !== null && l !== undefined)
                        .flatMap((l) =>
                          l.teachers.map((teacher) => teacher.name)
                        )
                    )
                  );
                  return replacedTeachers.length > 0
                    ? replacedTeachers.join(', ')
                    : '—';
                })()}
              </TableCell>
              <TableCell className="truncate">
                {sub.teacher ? (
                  `${sub.teacher.firstName} ${sub.teacher.lastName}`
                ) : (
                  <Badge variant="destructive">
                    {t('substitution.cancelled')}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="grid grid-cols-1 items-center justify-center gap-2 xl:grid-cols-2 2xl:grid-cols-3">
                  {sub.lessons.length > 0
                    ? sub.lessons
                        .filter((l) => l !== null && l !== undefined)
                        .map((l) => (
                          <Badge key={l.id} variant="secondary">
                            {l.subject?.short ?? '?'}
                            {', '}
                            {l.period?.period ?? '?'}
                            {'. '}
                            {t('substitution.period')}
                          </Badge>
                        ))
                    : t('substitution.noLessons')}
                </div>
              </TableCell>
              <TableCell>
                <div className="grid grid-cols-1 items-center justify-center gap-2 xl:grid-cols-2 2xl:grid-cols-3">
                  {(() => {
                    const cohorts = Array.from(
                      new Set(
                        sub.lessons
                          .filter((l) => l !== null && l !== undefined)
                          .flatMap((l) => l.cohorts.map((c) => c.name))
                      )
                    );

                    return cohorts.length > 0
                      ? cohorts.map((cohort) => (
                          <Badge key={cohort} variant="secondary">
                            {cohort}
                          </Badge>
                        ))
                      : t('substitution.noCohorts');
                  })()}
                </div>
              </TableCell>
              {hasWritePermission && (
                <TableCell>
                  <RowActions
                    deleteLabel={t('substitution.deleteConfirm')}
                    editLabel={t('substitution.edit')}
                    isDeleting={isDeleting}
                    onDelete={() => onDelete(sub)}
                    onEdit={() => onEdit(sub)}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
          {!(rows.length || hasError) && (
            <TableRow>
              <TableCell
                className="text-muted-foreground"
                colSpan={hasWritePermission ? 6 : 5}
              >
                {t('substitution.noSubstitutions')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function getSortValue(
  a: SubstitutionItem,
  sortColumn: SubstitutionSortColumn
): string {
  switch (sortColumn) {
    case 'date':
      return a.substitution.date.toISOString();
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
            .flatMap((l) => l.cohorts.map((cohort) => cohort.name))
        )
      ).join(' ');
    case 'replacedTeacher':
      return Array.from(
        new Set(
          a.lessons
            .filter((l) => l !== null && l !== undefined)
            .flatMap((l) => l.teachers.map((teacher) => teacher.name))
        )
      ).join(' ');
    default:
      return '';
  }
}
