import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@filcdev/ui/components/alert';
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
import { ArrowRightLeft, Plus, RefreshCw } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeleteConfirmDialog } from '@/components/admin/delete-confirm-dialog';
import {
  MovedLessonDialog,
  type MoveMode,
} from '@/components/admin/moved-lesson-dialog';
import { MovedLessonExportButton } from '@/components/admin/moved-lesson-export';
import { RowActions } from '@/components/admin/row-actions';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/date-range-picker';
import { PermissionGuard } from '@/components/util/permission-guard';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type DayDefinition,
  type EnrichedLesson,
  type MovedLessonItem,
  type Period,
  useCohortLessonsForCohorts,
  useDeleteMovedLesson,
  useMovedLessonClassrooms,
  useMovedLessonCohorts,
  useMovedLessonSubstitutions,
  useMovedLessons,
} from '@/hooks/moved-lessons';
import type { SubstitutionItem } from '@/hooks/substitutions';
import { useHasPermission } from '@/hooks/use-has-permission';
import { type UseSortableResult, useSortable } from '@/hooks/use-sortable';
import { formatLocalizedDate, getDayOrder } from '@/utils/date-locale';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/timetable/moved-lessons')(
  {
    component: () => (
      <PermissionGuard permission={permissions.movedLessonCreate}>
        <MovedLessonsPage />
      </PermissionGuard>
    ),
    loader: ({ context }) =>
      Promise.all([
        prefetch(context.queryClient, orpc.cohort.cohort.queryOptions()),
        prefetch(
          context.queryClient,
          orpc.timetable.substitutions.list.queryOptions()
        ),
        prefetch(
          context.queryClient,
          orpc.timetable.movedLessons.list.queryOptions()
        ),
        prefetch(
          context.queryClient,
          orpc.timetable.classrooms.getAll.queryOptions()
        ),
      ]),
  }
);

function extractFromMovedLessons(
  movedLessons: MovedLessonItem[],
  periodMap: Map<string, Period>,
  dayMap: Map<string, DayDefinition>
) {
  for (const ml of movedLessons) {
    if (ml.period) {
      periodMap.set(ml.period.id, ml.period);
    }
    if (ml.dayDefinition) {
      dayMap.set(ml.dayDefinition.id, ml.dayDefinition);
    }
  }
}

function extractFromSubstitutions(
  subs: SubstitutionItem[],
  periodMap: Map<string, Period>,
  dayMap: Map<string, DayDefinition>,
  lessonMap: Map<string, EnrichedLesson>
) {
  for (const sub of subs) {
    for (const lesson of sub.lessons) {
      if (!lesson) {
        continue;
      }
      lessonMap.set(lesson.id, lesson);
      registerLessonSchedule(lesson, periodMap, dayMap);
    }
  }
}

/** Register a lesson's own period and day in the reference maps. */
function registerLessonSchedule(
  lesson: EnrichedLesson,
  periodMap: Map<string, Period>,
  dayMap: Map<string, DayDefinition>
) {
  if (lesson.period) {
    periodMap.set(lesson.period.id, lesson.period);
  }
  if (lesson.day) {
    dayMap.set(lesson.day.id, {
      days: [],
      id: lesson.day.id,
      name: lesson.day.name,
      short: lesson.day.short,
    });
  }
}

// Also extract periods from cohort lessons
function extractFromCohortLessons(
  cohortLessonsLists: Array<{ lessons: EnrichedLesson[] }>,
  periodMap: Map<string, Period>,
  dayMap: Map<string, DayDefinition>,
  lessonMap: Map<string, EnrichedLesson>
) {
  for (const cohortLessons of cohortLessonsLists) {
    for (const lesson of cohortLessons.lessons) {
      if (!lesson) {
        continue;
      }
      lessonMap.set(lesson.id, lesson);
      registerLessonSchedule(lesson, periodMap, dayMap);
    }
  }
}

// Also include lessons from moved lessons (already enriched).
function extractFromMovedLessonLessons(
  movedLessons: MovedLessonItem[],
  periodMap: Map<string, Period>,
  dayMap: Map<string, DayDefinition>,
  lessonMap: Map<string, EnrichedLesson>
) {
  for (const ml of movedLessons) {
    for (const lesson of ml.lessons) {
      if (!lessonMap.has(lesson.id)) {
        lessonMap.set(lesson.id, lesson);
      }
      registerLessonSchedule(lesson, periodMap, dayMap);
    }
  }
}

function extractReferenceData(
  movedLessons: MovedLessonItem[],
  subs: SubstitutionItem[],
  cohortLessonsLists: Array<{ lessons: EnrichedLesson[] }>
) {
  const periodMap = new Map<string, Period>();
  const dayMap = new Map<string, DayDefinition>();
  const lessonMap = new Map<string, EnrichedLesson>();

  extractFromMovedLessons(movedLessons, periodMap, dayMap);
  extractFromSubstitutions(subs, periodMap, dayMap, lessonMap);
  extractFromCohortLessons(cohortLessonsLists, periodMap, dayMap, lessonMap);
  extractFromMovedLessonLessons(movedLessons, periodMap, dayMap, lessonMap);

  return {
    allLessons: Array.from(lessonMap.values()),
    days: Array.from(dayMap.values()).sort(
      (a, b) => getDayOrder(a.name, a.short) - getDayOrder(b.name, b.short)
    ),
    periods: Array.from(periodMap.values()).sort((a, b) => a.period - b.period),
  };
}

// A move that keeps the lesson's own day/period is a room move; otherwise it
// is a day move.
function detectMoveMode(item: MovedLessonItem): MoveMode {
  const firstLesson = item.lessons[0];
  if (
    firstLesson &&
    item.movedLesson.startingDay === firstLesson.day?.id &&
    item.movedLesson.startingPeriod === firstLesson.period?.id
  ) {
    return 'room';
  }
  return 'day';
}

function MovedLessonsPage() {
  const { t } = useTranslation();
  const showPastId = useId();
  const { data: session } = useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [moveMode, setMoveMode] = useState<MoveMode>('room');
  const [selectedItem, setSelectedItem] = useState<MovedLessonItem | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const itemToDelete = useRef<MovedLessonItem | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>({});

  const hasWritePermission = useHasPermission(
    permissions.movedLessonCreate,
    session?.user?.permissions
  );

  const movedLessonsQuery = useMovedLessons();

  const classroomsQuery = useMovedLessonClassrooms(hasWritePermission);

  const cohortsQuery = useMovedLessonCohorts(hasWritePermission);

  // Fetch substitutions to get enriched lessons list for the picker
  const substitutionsQuery = useMovedLessonSubstitutions(hasWritePermission);

  // Fetch lessons from all cohorts to ensure we have all periods
  const cohortLessonsQueries = useCohortLessonsForCohorts(
    cohortsQuery.data ?? [],
    hasWritePermission
  );

  // Extract unique day definitions from moved lessons data
  const { allLessons, days } = useMemo(
    () =>
      extractReferenceData(
        movedLessonsQuery.data ?? [],
        substitutionsQuery.data ?? [],
        cohortLessonsQueries.data ?? []
      ),
    [movedLessonsQuery.data, substitutionsQuery.data, cohortLessonsQueries.data]
  );

  const deleteMutation = useDeleteMovedLesson();

  const matchingMovedLessons = useMemo(() => {
    let list = movedLessonsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    const today = dayjs().startOf('day');

    // Dátum szerinti szűrés (csak mai és jövőbeli, ha showPast false)
    if (!showPast) {
      list = list.filter((ml) => {
        const mlDate = dayjs(ml.movedLesson.date).startOf('day');
        return !mlDate.isBefore(today);
      });
    }

    // Keresés szerinti szűrés
    if (term) {
      list = list.filter((ml) => {
        const roomName = ml.classroom?.name?.toLowerCase() ?? '';
        const dayName = ml.dayDefinition?.name?.toLowerCase() ?? '';
        return (
          ml.movedLesson.date.toISOString().includes(term) ||
          roomName.includes(term) ||
          dayName.includes(term)
        );
      });
    }

    return list;
  }, [movedLessonsQuery.data, search, showPast]);

  // Only the day column needs custom order; the rest fall back to the hook's
  // numeric-or-lexical default, which matches what this table used to inline.
  const { rows: filteredMovedLessons, ...sort } = useSortable(
    matchingMovedLessons,
    {
      compare: compareDayColumn,
      getValue: getMovedLessonSortValue,
    }
  );

  const handleDelete = (ml: MovedLessonItem) => {
    if (!hasWritePermission) {
      return;
    }
    itemToDelete.current = ml;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete.current) {
      return;
    }
    await deleteMutation.mutateAsync({
      id: itemToDelete.current.movedLesson.id,
    });
    setDeleteDialogOpen(false);
    itemToDelete.current = null;
  };

  const isLoading = movedLessonsQuery.isLoading;
  const hasError = movedLessonsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('movedLesson.title')}
        </h1>
        <p className="text-muted-foreground">{t('movedLesson.description')}</p>
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
            {t('movedLesson.showPast')}
          </label>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <div className="w-fit">
            <DateRangePicker onChange={setDateRange} value={dateRange} />
          </div>
          <MovedLessonExportButton dateRange={dateRange} />
          <Button
            aria-label={t('movedLesson.refresh')}
            onClick={() => movedLessonsQuery.refetch()}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">{t('movedLesson.refresh')}</span>
          </Button>
          {hasWritePermission && (
            <Button
              aria-label={t('movedLesson.create')}
              onClick={() => {
                setSelectedItem(null);
                setMoveMode('room');
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">
                {t('movedLesson.create')}
              </span>
            </Button>
          )}
        </div>
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>{t('movedLesson.loadError')}</AlertTitle>
          <AlertDescription>
            {(movedLessonsQuery.error as Error)?.message ??
              t('movedLesson.loadErrorMessage')}
          </AlertDescription>
        </Alert>
      )}

      <MovedLessonsTable
        deletePending={deleteMutation.isPending}
        hasError={hasError}
        hasWritePermission={hasWritePermission}
        isLoading={isLoading}
        onDelete={handleDelete}
        onEdit={(ml) => {
          setSelectedItem(ml);
          setMoveMode(detectMoveMode(ml));
          setDialogOpen(true);
        }}
        rows={filteredMovedLessons}
        sort={sort}
      />

      {hasWritePermission && dialogOpen && (
        <MovedLessonDialog
          allLessons={allLessons}
          classrooms={classroomsQuery.data ?? []}
          cohorts={cohortsQuery.data ?? []}
          days={days}
          item={selectedItem}
          key={selectedItem?.movedLesson.id ?? 'new'}
          mode={moveMode}
          onModeChange={setMoveMode}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setSelectedItem(null);
              setMoveMode('room');
            }
          }}
          open={dialogOpen}
        />
      )}

      {hasWritePermission && (
        <DeleteConfirmDialog
          description={t('movedLesson.deleteDescription')}
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
          title={t('movedLesson.deleteConfirm')}
        />
      )}
    </div>
  );
}

type MovedLessonSortColumn = 'date' | 'day' | 'period' | 'room' | 'count';

type MovedLessonsTableProps = {
  deletePending: boolean;
  hasError: boolean;
  hasWritePermission: boolean;
  isLoading: boolean;
  onDelete: (ml: MovedLessonItem) => void;
  onEdit: (ml: MovedLessonItem) => void;
  rows: MovedLessonItem[];
  sort: Pick<
    UseSortableResult<MovedLessonItem, MovedLessonSortColumn>,
    'ariaSort' | 'column' | 'direction' | 'toggle'
  >;
};

function MovedLessonsTable({
  deletePending,
  hasError,
  hasWritePermission,
  isLoading,
  onDelete,
  onEdit,
  rows,
  sort,
}: MovedLessonsTableProps) {
  const { i18n, t } = useTranslation();
  const { ariaSort, direction, toggle } = sort;

  const header = (column: MovedLessonSortColumn, label: string) => (
    <TableHead
      aria-sort={ariaSort(column)}
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => toggle(column)}
    >
      <div className="flex items-center gap-2">
        {label}
        <SortIcon
          column={column}
          currentColumn={column}
          direction={direction}
        />
      </div>
    </TableHead>
  );

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full min-w-3xl">
        <TableHeader>
          <TableRow>
            {header('date', t('movedLesson.date'))}
            {header('day', t('movedLesson.targetDay'))}
            {header('period', t('movedLesson.targetPeriod'))}
            {header('room', t('movedLesson.targetRoom'))}
            {header('count', t('movedLesson.lessonsCount'))}
            <TableHead>{t('movedLesson.comment')}</TableHead>
            {hasWritePermission && (
              <TableHead>{t('movedLesson.actions')}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((ml) => (
            <TableRow key={ml.movedLesson.id}>
              <TableCell className="font-medium">
                {formatLocalizedDate(ml.movedLesson.date, i18n.language)}
              </TableCell>
              <TableCell>
                {ml.dayDefinition
                  ? `${ml.dayDefinition.name} (${ml.dayDefinition.short})`
                  : '-'}
              </TableCell>
              <TableCell>
                {ml.period
                  ? `P${ml.period.period} (${ml.period.startTime.toString().slice(0, 5)}\u2013${ml.period.endTime.toString().slice(0, 5)})`
                  : '-'}
              </TableCell>
              <TableCell>{ml.classroom ? ml.classroom.name : '-'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                  {ml.lessons.length}
                </div>
              </TableCell>
              <TableCell>
                {ml.movedLesson.comment ? (
                  <span className="whitespace-pre-wrap text-sm">
                    {ml.movedLesson.comment}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              {hasWritePermission && (
                <TableCell>
                  <RowActions
                    deleteLabel={t('movedLesson.deleteConfirm')}
                    editLabel={t('movedLesson.edit')}
                    isDeleting={deletePending}
                    onDelete={() => onDelete(ml)}
                    onEdit={() => onEdit(ml)}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
          {!(rows.length || hasError) && (
            <TableRow>
              <TableCell
                className="text-muted-foreground"
                colSpan={hasWritePermission ? 7 : 6}
              >
                {t('movedLesson.noMovedLessons')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function getMovedLessonSortValue(
  ml: MovedLessonItem,
  sortColumn: MovedLessonSortColumn
): string | number {
  switch (sortColumn) {
    case 'date':
      return ml.movedLesson.date.toISOString();
    case 'day':
      return ml.dayDefinition?.name ?? '';
    case 'period':
      return ml.period?.period ?? 0;
    case 'room':
      return ml.classroom?.name ?? '';
    case 'count':
      return ml.lessons.length;
    default:
      return '';
  }
}

// Special handling for 'day' column - order by week day sequence
function compareByDayOrder(
  a: MovedLessonItem,
  b: MovedLessonItem,
  sortDirection: 'asc' | 'desc'
) {
  const aOrder = getDayOrder(
    a.dayDefinition?.name ?? '',
    a.dayDefinition?.short
  );
  const bOrder = getDayOrder(
    b.dayDefinition?.name ?? '',
    b.dayDefinition?.short
  );
  const comparison = aOrder - bOrder;
  return sortDirection === 'asc' ? comparison : -comparison;
}

/**
 * The only column `useSortable` cannot order by itself: days sort in week
 * order, not alphabetically. Returning `undefined` for the others hands them to
 * the hook's numeric-or-lexical default.
 */
function compareDayColumn(
  a: MovedLessonItem,
  b: MovedLessonItem,
  sortColumn: 'date' | 'day' | 'period' | 'room' | 'count',
  sortDirection: 'asc' | 'desc'
) {
  return sortColumn === 'day'
    ? compareByDayOrder(a, b, sortDirection)
    : undefined;
}
