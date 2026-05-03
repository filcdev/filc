import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import { ArrowRightLeft, Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MovedLessonDialog } from '@/components/admin/moved-lesson-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { authClient } from '@/utils/authentication';
import { confirmDestructiveAction } from '@/utils/confirm';
import { formatLocalizedDate, getDayOrder } from '@/utils/date-locale';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type MovedLessonApiResponse = InferResponseType<
  typeof api.timetable.movedLessons.$get
>;
type MovedLessonItem = NonNullable<MovedLessonApiResponse['data']>[number];
type Classroom = Omit<
  NonNullable<MovedLessonItem['classroom']>,
  'createdAt' | 'updatedAt'
>;
type Period = Omit<
  NonNullable<MovedLessonItem['period']>,
  'createdAt' | 'updatedAt'
>;
type DayDefinition = Omit<
  NonNullable<MovedLessonItem['dayDefinition']>,
  'createdAt' | 'updatedAt'
>;

type SubstitutionApiResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;
type SubstitutionData = NonNullable<SubstitutionApiResponse['data']>[number];
type EnrichedLesson = Omit<
  NonNullable<SubstitutionData['lessons'][number]>,
  'createdAt' | 'updatedAt'
>;

export const Route = createFileRoute('/_private/admin/timetable/moved-lessons')(
  {
    component: () => (
      <PermissionGuard permission="movedLesson:create">
        <MovedLessonsPage />
      </PermissionGuard>
    ),
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
  subs: SubstitutionData[],
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
  }
}

function extractReferenceData(
  movedLessons: MovedLessonItem[],
  subs: SubstitutionData[],
  cohortLessonsLists: Array<{ lessons: EnrichedLesson[] }>
) {
  const periodMap = new Map<string, Period>();
  const dayMap = new Map<string, DayDefinition>();
  const lessonMap = new Map<string, EnrichedLesson>();

  extractFromMovedLessons(movedLessons, periodMap, dayMap);
  extractFromSubstitutions(subs, periodMap, dayMap, lessonMap);

  // Also extract periods from cohort lessons
  for (const cohortLessons of cohortLessonsLists) {
    for (const lesson of cohortLessons.lessons) {
      if (!lesson) {
        continue;
      }
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
  }

  const sortedDays = Array.from(dayMap.values()).sort((a, b) => {
    const aOrder = getDayOrder(a.name, a.short);
    const bOrder = getDayOrder(b.name, b.short);
    return aOrder - bOrder;
  });

  return {
    allLessons: Array.from(lessonMap.values()),
    days: sortedDays,
    periods: Array.from(periodMap.values()).sort((a, b) => a.period - b.period),
  };
}

function MovedLessonsPage() {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MovedLessonItem | null>(
    null
  );
  const [sortColumn, setSortColumn] = useState<
    'date' | 'day' | 'period' | 'room' | 'count' | null
  >(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
  const [showPast, setShowPast] = useState(false);

  const hasWritePermission = useHasPermission(
    'movedLesson:create',
    session?.user?.permissions
  );

  const movedLessonsQuery = useQuery({
    queryFn: async (): Promise<MovedLessonItem[]> => {
      const res = await parseResponse(api.timetable.movedLessons.$get());
      if (!res.success) {
        throw new Error('Failed to load moved lessons');
      }
      return res.data as MovedLessonItem[];
    },
    queryKey: queryKeys.movedLessons(),
  });

  const classroomsQuery = useQuery({
    enabled: hasWritePermission,
    queryFn: async (): Promise<Classroom[]> => {
      const res = await parseResponse(api.timetable.classrooms.getAll.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load classrooms');
      }
      return res.data as Classroom[];
    },
    queryKey: queryKeys.classrooms(),
  });

  const cohortsQuery = useQuery({
    enabled: hasWritePermission,
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return res.data;
    },
    queryKey: queryKeys.cohorts(),
  });

  // Fetch substitutions to get enriched lessons list for the picker
  const substitutionsQuery = useQuery({
    enabled: hasWritePermission,
    queryFn: async () => {
      const res = await parseResponse(api.timetable.substitutions.$get());
      if (!res.success) {
        throw new Error('Failed to load substitutions');
      }
      return res.data as SubstitutionData[];
    },
    queryKey: queryKeys.substitutions(),
  });

  // Fetch lessons from all cohorts to ensure we have all periods
  const cohortLessonsQueries = useQuery({
    enabled: hasWritePermission && (cohortsQuery.data?.length ?? 0) > 0,
    queryFn: async () => {
      const cohorts = cohortsQuery.data ?? [];
      const results = await Promise.all(
        cohorts.map(async (cohort) => {
          const res = await parseResponse(
            api.timetable.lessons.getForCohort[':cohortId'].$get({
              param: { cohortId: cohort.id },
            })
          );
          if (!res.success) {
            return { lessons: [] };
          }
          return { lessons: (res.data ?? []) as unknown as EnrichedLesson[] };
        })
      );
      return results;
    },
    queryKey: queryKeys.timetable.cohortLessons(cohortsQuery.data),
  });

  // Extract unique periods and day definitions from moved lessons data
  const { allLessons, days, periods } = useMemo(
    () =>
      extractReferenceData(
        movedLessonsQuery.data ?? [],
        substitutionsQuery.data ?? [],
        cohortLessonsQueries.data ?? []
      ),
    [movedLessonsQuery.data, substitutionsQuery.data, cohortLessonsQueries.data]
  );

  const $createMovedLesson = api.timetable.movedLessons.$post;
  const createMutation = useMutation<
    InferResponseType<typeof $createMovedLesson>,
    Error,
    InferRequestType<typeof $createMovedLesson>['json']
  >({
    mutationFn: async (payload) => {
      const res = await parseResponse(
        $createMovedLesson({
          json: payload,
        })
      );
      if (!res.success) {
        throw new Error('Failed to create moved lesson');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('movedLesson.createError'));
    },
    onSuccess: () => {
      toast.success(t('movedLesson.createSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.movedLessons() });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const $updateMovedLesson = api.timetable.movedLessons[':id'].$put;
  const updateMutation = useMutation<
    InferResponseType<typeof $updateMovedLesson>,
    Error,
    { id: string; payload: InferRequestType<typeof $updateMovedLesson>['json'] }
  >({
    mutationFn: async ({ id, payload }) => {
      const res = await parseResponse(
        api.timetable.movedLessons[':id'].$put({ json: payload, param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to update moved lesson');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('movedLesson.updateError'));
    },
    onSuccess: () => {
      toast.success(t('movedLesson.updateSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.movedLessons() });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const $deleteMovedLesson = api.timetable.movedLessons[':id'].$delete;
  const deleteMutation = useMutation<
    InferResponseType<typeof $deleteMovedLesson>,
    Error,
    string
  >({
    mutationFn: async (id: string) =>
      parseResponse(
        api.timetable.movedLessons[':id'].$delete({ param: { id } })
      ),
    onError: (error: Error) => {
      toast.error(error.message || t('movedLesson.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('movedLesson.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.movedLessons() });
    },
  });

  const filteredMovedLessons = useMemo(() => {
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
          ml.movedLesson.date.includes(term) ||
          roomName.includes(term) ||
          dayName.includes(term)
        );
      });
    }

    // Rendezés
    if (sortColumn && sortDirection) {
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sorting logic
      list = [...list].sort((a, b) => {
        // Special handling for 'day' column - order by week day sequence
        if (sortColumn === 'day') {
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

        const aVal = getMovedLessonSortValue(a, sortColumn);
        const bVal = getMovedLessonSortValue(b, sortColumn);

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comparison = aVal.localeCompare(bVal);
          return sortDirection === 'asc' ? comparison : -comparison;
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    }

    return list;
  }, [movedLessonsQuery.data, search, sortColumn, sortDirection, showPast]);

  const handleSort = (column: 'date' | 'day' | 'period' | 'room' | 'count') => {
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

  const create = api.timetable.movedLessons.$post;
  const upd = api.timetable.movedLessons[':id'].$put;
  type MovedLessonPayload = InferRequestType<typeof create>['json'];

  const handleSave = async (payload: MovedLessonPayload) => {
    if (selectedItem) {
      // For updates, ensure all required fields are present
      const hasAllFields =
        Boolean(payload.room) &&
        Boolean(payload.startingDay) &&
        Boolean(payload.startingPeriod);
      if (!hasAllFields) {
        throw new Error('All fields are required for updates');
      }
      // At this point TypeScript knows these fields are defined
      const updatePayload: InferRequestType<typeof upd>['json'] = {
        date: payload.date,
        lessonIds: payload.lessonIds ?? [],
        room: payload.room as string,
        startingDay: payload.startingDay as string,
        startingPeriod: payload.startingPeriod as string,
      };
      await updateMutation.mutateAsync({
        id: selectedItem.movedLesson.id,
        payload: updatePayload,
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleDelete = async (ml: MovedLessonItem) => {
    if (!hasWritePermission) {
      return;
    }
    const confirmed = confirmDestructiveAction(t('movedLesson.deleteConfirm'));
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(ml.movedLesson.id);
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
            id="show-past-moved"
            onCheckedChange={(checked) => setShowPast(checked === true)}
          />
          <label
            className="cursor-pointer font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor="show-past-moved"
          >
            {t('movedLesson.showPast')}
          </label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => movedLessonsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('movedLesson.refresh')}
          </Button>
          {hasWritePermission && (
            <Button
              onClick={() => {
                setSelectedItem(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('movedLesson.create')}
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
                    {t('movedLesson.date')}
                    <SortIcon
                      column="date"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('day')}
                >
                  <div className="flex items-center gap-2">
                    {t('movedLesson.targetDay')}
                    <SortIcon
                      column="day"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('period')}
                >
                  <div className="flex items-center gap-2">
                    {t('movedLesson.targetPeriod')}
                    <SortIcon
                      column="period"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('room')}
                >
                  <div className="flex items-center gap-2">
                    {t('movedLesson.targetRoom')}
                    <SortIcon
                      column="room"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('count')}
                >
                  <div className="flex items-center gap-2">
                    {t('movedLesson.lessonsCount')}
                    <SortIcon
                      column="count"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                {hasWritePermission && (
                  <TableHead>{t('movedLesson.actions')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovedLessons.map((ml) => (
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
                  <TableCell>
                    {ml.classroom ? ml.classroom.name : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                      {ml.lessons.length}
                    </div>
                  </TableCell>
                  {hasWritePermission && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setSelectedItem(ml);
                            setDialogOpen(true);
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pen className="h-4 w-4" />
                        </Button>
                        <Button
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(ml)}
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
              {!(filteredMovedLessons.length || hasError) && (
                <TableRow>
                  <TableCell
                    className="text-muted-foreground"
                    colSpan={hasWritePermission ? 6 : 5}
                  >
                    {t('movedLesson.noMovedLessons')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {hasWritePermission && (
        <MovedLessonDialog
          allLessons={allLessons}
          classrooms={classroomsQuery.data ?? []}
          cohorts={cohortsQuery.data ?? []}
          days={days}
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
          periods={periods}
        />
      )}
    </div>
  );
}

function getMovedLessonSortValue(
  ml: MovedLessonItem,
  sortColumn: 'date' | 'day' | 'period' | 'room' | 'count'
): string | number {
  switch (sortColumn) {
    case 'date':
      return ml.movedLesson.date;
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
