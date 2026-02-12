import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { parseResponse } from 'hono/client';
import { ArrowRightLeft, Pen, Plus, RefreshCw, Trash } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MovedLessonDialog } from '@/components/admin/moved-lesson-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { confirmDestructiveAction } from '@/utils/confirm';
import { api } from '@/utils/hc';

type Classroom = {
  id: string;
  name: string;
  short: string;
};

type Period = {
  endTime: string;
  id: string;
  period: number;
  startTime: string;
};

type DayDefinition = {
  days: string[];
  id: string;
  name: string;
  short: string;
};

type EnrichedLesson = {
  classrooms: { id: string; name: string; short: string }[];
  cohorts: string[];
  day: { id: string; name: string; short: string } | null;
  id: string;
  period: {
    endTime: string;
    id: string;
    period: number;
    startTime: string;
  } | null;
  subject: { id: string; name: string; short: string } | null;
  teachers: { id: string; name: string; short: string }[];
};

type MovedLessonItem = {
  classroom: Classroom | null;
  dayDefinition: DayDefinition | null;
  lessons: string[];
  movedLesson: {
    date: string;
    id: string;
    room: string | null;
    startingDay: string | null;
    startingPeriod: string | null;
  };
  period: Period | null;
};

export const Route = createFileRoute('/_private/admin/timetable/moved-lessons')(
  {
    component: () => (
      <PermissionGuard permission="movedLesson:create">
        <MovedLessonsPage />
      </PermissionGuard>
    ),
  }
);

type SubstitutionData = {
  lessons: EnrichedLesson[];
  substitution: { date: string; id: string; substituter: string | null };
  teacher: unknown;
};

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
  subs: SubstitutionData[]
) {
  const periodMap = new Map<string, Period>();
  const dayMap = new Map<string, DayDefinition>();
  const lessonMap = new Map<string, EnrichedLesson>();

  extractFromMovedLessons(movedLessons, periodMap, dayMap);
  extractFromSubstitutions(subs, periodMap, dayMap, lessonMap);

  return {
    allLessons: Array.from(lessonMap.values()),
    days: Array.from(dayMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    periods: Array.from(periodMap.values()).sort((a, b) => a.period - b.period),
  };
}

function MovedLessonsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MovedLessonItem | null>(
    null
  );

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
    queryKey: ['movedLessons'],
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
    queryKey: ['classrooms'],
  });

  const cohortsQuery = useQuery({
    enabled: hasWritePermission,
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return (res.data ?? []) as { id: string; name: string }[];
    },
    queryKey: ['cohorts'],
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
    queryKey: ['substitutions'],
  });

  // Extract unique periods and day definitions from moved lessons data
  const { allLessons, days, periods } = useMemo(
    () =>
      extractReferenceData(
        movedLessonsQuery.data ?? [],
        substitutionsQuery.data ?? []
      ),
    [movedLessonsQuery.data, substitutionsQuery.data]
  );

  const createMutation = useMutation({
    mutationFn: async (payload: {
      date: string;
      lessonIds: string[];
      room: string | null;
      startingDay: string | null;
      startingPeriod: string | null;
    }) => {
      const res = await parseResponse(
        api.timetable.movedLessons.$post({
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
      queryClient.invalidateQueries({ queryKey: ['movedLessons'] });
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
      payload: {
        date?: string;
        lessonIds?: string[];
        room?: string | null;
        startingDay?: string | null;
        startingPeriod?: string | null;
      };
    }) => {
      const res = await parseResponse(
        api.timetable.movedLessons[':id'].$put(
          { param: { id } },
          {
            init: { body: JSON.stringify(payload) },
          }
        )
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
      queryClient.invalidateQueries({ queryKey: ['movedLessons'] });
      setDialogOpen(false);
      setSelectedItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      parseResponse(
        api.timetable.movedLessons[':id'].$delete({ param: { id } })
      ),
    onError: (error: Error) => {
      toast.error(error.message || t('movedLesson.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('movedLesson.deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['movedLessons'] });
    },
  });

  const filteredMovedLessons = useMemo(() => {
    const list = movedLessonsQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return list;
    }
    return list.filter((ml) => {
      const roomName = ml.classroom?.name?.toLowerCase() ?? '';
      const dayName = ml.dayDefinition?.name?.toLowerCase() ?? '';
      return (
        ml.movedLesson.date.includes(term) ||
        roomName.includes(term) ||
        dayName.includes(term)
      );
    });
  }, [movedLessonsQuery.data, search]);

  const handleSave = async (payload: {
    date: string;
    lessonIds: string[];
    room: string | null;
    startingDay: string | null;
    startingPeriod: string | null;
  }) => {
    if (selectedItem) {
      await updateMutation.mutateAsync({
        id: selectedItem.movedLesson.id,
        payload,
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('movedLesson.date')}</TableHead>
              <TableHead>{t('movedLesson.targetDay')}</TableHead>
              <TableHead>{t('movedLesson.targetPeriod')}</TableHead>
              <TableHead>{t('movedLesson.targetRoom')}</TableHead>
              <TableHead>{t('movedLesson.lessonsCount')}</TableHead>
              {hasWritePermission && (
                <TableHead>{t('movedLesson.actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMovedLessons.map((ml) => (
              <TableRow key={ml.movedLesson.id}>
                <TableCell className="font-medium">
                  {dayjs(ml.movedLesson.date).format('YYYY/MM/DD')}
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

function useHasPermission(permission: string, permissions?: string[] | null) {
  if (!permissions) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(permission);
}
