import { pdf } from '@react-pdf/renderer';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type z from 'zod';
import { FilterBar } from '@/components/timetable/filter-bar';
import { TimetableGrid } from '@/components/timetable/grid';
import { buildViewModel } from '@/components/timetable/helpers';
import { TimetablePDF } from '@/components/timetable/pdf/document';
import { PrintDialog } from '@/components/timetable/print-dialog';
import type {
  ClassroomItem,
  CohortItem,
  FilterType,
  LessonItem,
  PeriodItem,
  SelectionsType,
  TeacherItem,
  TimetableItem,
  TimetableViewModel,
} from '@/components/timetable/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Route, type searchSchema } from '@/routes/_public/index';
import { useApiMutation, useApiQuery } from '@/utils/api';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

// Constants
const QUERY_OPTIONS = {
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: Number.POSITIVE_INFINITY,
};

// Helpers
const getActiveSelectionId = (
  filter: FilterType,
  selections: SelectionsType
) => {
  switch (filter) {
    case 'class':
      return selections.class;
    case 'teacher':
      return selections.teacher;
    case 'classroom':
      return selections.classroom;
    default:
      return null;
  }
};

// Component
export function TimetableView() {
  const search = Route.useSearch();
  const { i18n } = useTranslation();
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const isAuthenticated = !isPending && !!session;

  // Fetch user settings for class colors (authenticated users only)
  const settingsQuery = useApiQuery<{
    timetableClassColors?: Record<string, number>;
  }>(() => api.notifications.settings.$get(), {
    enabled: isAuthenticated,
    queryKey: queryKeys.notifications.settings(),
  });
  const userColors = isAuthenticated
    ? (settingsQuery.data?.timetableClassColors ?? {})
    : {};

  // Mutation to save class color
  const colorMutation = useApiMutation({
    mutationFn: async ({
      subject,
      colorIndex,
    }: {
      subject: string;
      colorIndex: number;
    }) => {
      const newColors = { ...userColors, [subject]: colorIndex };
      const res = await api.notifications.settings.$patch({
        json: { timetableClassColors: newColors },
      });
      if (!res) {
        throw new Error('Failed to save color');
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.settings(),
      });
    },
  });

  const handleColorChange = useCallback(
    (subject: string, colorIndex: number) => {
      colorMutation.mutate({ colorIndex, subject });
    },
    [colorMutation]
  );

  // Timetable query (all timetables for the selector)
  const timetablesQuery = useApiQuery<TimetableItem[]>(
    () => api.timetable.timetables.$get(),
    { ...QUERY_OPTIONS, queryKey: queryKeys.timetables.all() }
  );

  // Compute the latest valid timetable id from the list
  const latestValidTimetableQuery = useApiQuery<TimetableItem | null>(
    () => api.timetable.timetables.latestValid.$get(),
    { ...QUERY_OPTIONS, queryKey: queryKeys.timetables.latestValid() }
  );

  const latestValidTimetableId =
    latestValidTimetableQuery.data?.id ?? timetablesQuery.data?.[0]?.id ?? null;

  // Selected timetable — initialised from URL param, else latestValid
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(
    search.timetable ?? null
  );

  // Once we know the latest valid, set it as default if nothing is selected
  useEffect(() => {
    if (!selectedTimetableId && latestValidTimetableId) {
      setSelectedTimetableId(latestValidTimetableId);
    }
  }, [selectedTimetableId, latestValidTimetableId]);

  // Queries
  const cohortsQuery = useApiQuery<CohortItem[]>(
    () => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const timetableId = selectedTimetableId!;
      return api.timetable.cohorts.getAllForTimetable[':timetableId'].$get({
        param: { timetableId },
      });
    },
    {
      ...QUERY_OPTIONS,
      enabled: !!selectedTimetableId,
      queryKey: queryKeys.timetable.cohorts(selectedTimetableId),
    }
  );

  const teachersQuery = useApiQuery<TeacherItem[]>(
    () => api.timetable.teachers.getAll.$get(),
    { ...QUERY_OPTIONS, queryKey: queryKeys.teachers() }
  );

  const classroomsQuery = useApiQuery<ClassroomItem[]>(
    () => api.timetable.classrooms.getAll.$get(),
    { ...QUERY_OPTIONS, queryKey: queryKeys.classrooms() }
  );

  const periodsQuery = useApiQuery<PeriodItem[]>(
    () => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const timetableId = selectedTimetableId!;
      return api.timetable.periods.getAll.$get({
        query: { timetableId },
      });
    },
    {
      ...QUERY_OPTIONS,
      enabled: !!selectedTimetableId,
      queryKey: queryKeys.timetable.periods(selectedTimetableId),
    }
  );

  // State
  const [activeFilter, setActiveFilter] = useState<FilterType>(() => {
    if (search.cohort) {
      return 'class';
    }
    if (search.teacher) {
      return 'teacher';
    }
    if (search.room) {
      return 'classroom';
    }
    return 'class';
  });
  const [selections, setSelections] = useState<SelectionsType>({
    class: null,
    classroom: null,
    teacher: null,
  });
  const [initialized, setInitialized] = useState(false);

  const activeSelectionId = getActiveSelectionId(activeFilter, selections);

  // Fetch lessons
  const lessonsQuery = useApiQuery<LessonItem[]>(
    () => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const selectionId = activeSelectionId!;
      const timetableId = selectedTimetableId;
      const query = timetableId ? { timetableId } : {};
      if (activeFilter === 'class') {
        return api.timetable.lessons.getForCohort[':cohortId'].$get({
          param: { cohortId: selectionId },
          query,
        });
      }
      if (activeFilter === 'classroom') {
        return api.timetable.lessons.getForRoom[':classroomId'].$get({
          param: { classroomId: selectionId },
          query,
        });
      }
      return api.timetable.lessons.getForTeacher[':teacherId'].$get({
        param: { teacherId: selectionId },
        query,
      });
    },
    {
      ...QUERY_OPTIONS,
      enabled: !!activeSelectionId,
      queryKey: queryKeys.timetable.lessons(
        activeFilter,
        activeSelectionId,
        selectedTimetableId
      ),
    }
  );

  // Initialize from URL or defaults
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO
  useEffect(() => {
    const allDataLoaded =
      cohortsQuery.data && teachersQuery.data && classroomsQuery.data;

    if (!allDataLoaded || initialized || isPending) {
      return;
    }

    // Validate search params against available data
    const cohortClass =
      search.cohort && cohortsQuery.data.some((c) => c.id === search.cohort)
        ? search.cohort
        : null;

    const cohortTeacher =
      search.teacher && teachersQuery.data.some((t) => t.id === search.teacher)
        ? search.teacher
        : null;

    const cohortClassroom =
      search.room && classroomsQuery.data.some((c) => c.id === search.room)
        ? search.room
        : null;

    if (cohortClass) {
      setActiveFilter('class');
      setSelections((s) => ({ ...s, class: cohortClass }));
    } else if (cohortTeacher) {
      setActiveFilter('teacher');
      setSelections((s) => ({ ...s, teacher: cohortTeacher }));
    } else if (cohortClassroom) {
      setActiveFilter('classroom');
      setSelections((s) => ({ ...s, classroom: cohortClassroom }));
    } else {
      const userClassId = session?.user?.cohortId ?? null;
      const userDefault = cohortsQuery.data?.find(
        (cohort) => cohort.id === userClassId
      )?.id;
      const firstCohort = cohortsQuery.data[0]?.id ?? null;
      const fallbackClass = userDefault ?? firstCohort;
      setActiveFilter('class');
      setSelections((s) => ({ ...s, class: fallbackClass }));
    }

    setInitialized(true);
  }, [
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
    session,
    isPending,
    initialized,
    search.cohort,
    search.teacher,
    search.room,
  ]);

  // Set default selection when filter changes
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO
  useEffect(() => {
    if (!initialized) {
      return;
    }

    const firstCohort = cohortsQuery.data?.[0];
    const firstTeacher = teachersQuery.data?.[0];
    const firstClassroom = classroomsQuery.data?.[0];

    switch (activeFilter) {
      case 'class':
        if (!selections.class && firstCohort) {
          setSelections((s) => ({ ...s, class: firstCohort.id }));
        }
        break;
      case 'teacher':
        if (!selections.teacher && firstTeacher) {
          setSelections((s) => ({ ...s, teacher: firstTeacher.id }));
        }
        break;
      case 'classroom':
        if (!selections.classroom && firstClassroom) {
          setSelections((s) => ({ ...s, classroom: firstClassroom.id }));
        }
        break;
      default:
        break;
    }
  }, [
    initialized,
    activeFilter,
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
    selections.class,
    selections.classroom,
    selections.teacher,
  ]);

  // Reset class selection when timetable changes (cohorts are timetable-scoped)
  const [prevTimetableId, setPrevTimetableId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedTimetableId && selectedTimetableId !== prevTimetableId) {
      if (prevTimetableId !== null) {
        setSelections((s) => ({ ...s, class: null }));
        setInitialized(false);
      }
      setPrevTimetableId(selectedTimetableId);
    }
  }, [selectedTimetableId, prevTimetableId]);

  // Sync selection to URL
  useEffect(() => {
    if (activeSelectionId) {
      const searchParams: z.Infer<typeof searchSchema> = {
        cohort: undefined,
        room: undefined,
        teacher: undefined,
        timetable: selectedTimetableId ?? undefined,
      };

      const paramKey = `${activeFilter}` as 'cohort' | 'teacher' | 'room';
      searchParams[paramKey] = activeSelectionId;
      navigate({
        replace: true,
        search: () => searchParams,
      });
    }
  }, [activeFilter, activeSelectionId, selectedTimetableId, navigate]);

  const model = useMemo(
    () =>
      buildViewModel(
        (lessonsQuery.data ?? []) as LessonItem[],
        i18n.language,
        (periodsQuery.data ?? []) as PeriodItem[]
      ),
    [lessonsQuery.data, periodsQuery.data, i18n.language]
  );

  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const getSelectionLabel = (): string => {
    switch (activeFilter) {
      case 'class':
        return (
          cohortsQuery.data?.find((c) => c.id === selections.class)?.name ?? ''
        );
      case 'teacher': {
        const teacher = teachersQuery.data?.find(
          (t) => t.id === selections.teacher
        );
        if (!teacher) {
          return '';
        }
        return `${teacher.firstName} ${teacher.lastName}`.trim();
      }
      case 'classroom':
        return (
          classroomsQuery.data?.find((c) => c.id === selections.classroom)
            ?.name ?? ''
        );
      default:
        return '';
    }
  };

  const handleGeneratePdf = async (blackAndWhite: boolean): Promise<void> => {
    const timetableName =
      timetablesQuery.data?.find((t) => t.id === selectedTimetableId)?.name ??
      '';
    const label = getSelectionLabel();
    const generatedAt = new Date().toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const blob = await pdf(
      <TimetablePDF
        blackAndWhite={blackAndWhite}
        generatedAt={generatedAt}
        label={label}
        model={model as TimetableViewModel}
        timetableName={timetableName}
      />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const getSelectorLoading = () => {
    switch (activeFilter) {
      case 'class':
        return cohortsQuery.isLoading;
      case 'teacher':
        return teachersQuery.isLoading;
      case 'classroom':
        return classroomsQuery.isLoading;
      default:
        return false;
    }
  };

  const selectorLoading = getSelectorLoading();

  const isLoading =
    selectorLoading || lessonsQuery.isLoading || !activeSelectionId;
  const hasError =
    cohortsQuery.error ||
    teachersQuery.error ||
    classroomsQuery.error ||
    lessonsQuery.error;

  return (
    <div className="flex grow flex-col items-center p-4">
      <div className="flex w-full max-w-7xl flex-col gap-4">
        <FilterBar
          activeFilter={activeFilter}
          classrooms={classroomsQuery.data}
          cohorts={cohortsQuery.data}
          disabled={isLoading}
          onFilterChange={setActiveFilter}
          onPrint={() => setPrintDialogOpen(true)}
          onSelectClass={(id) => setSelections((s) => ({ ...s, class: id }))}
          onSelectRoom={(id) => setSelections((s) => ({ ...s, classroom: id }))}
          onSelectTeacher={(id) =>
            setSelections((s) => ({ ...s, teacher: id }))
          }
          onSelectTimetable={setSelectedTimetableId}
          selectedByClass={selections.class}
          selectedByRoom={selections.classroom}
          selectedByTeacher={selections.teacher}
          selectedTimetableId={selectedTimetableId}
          selectorLoading={selectorLoading}
          teachers={teachersQuery.data}
          timetables={timetablesQuery.data}
        />

        <PrintDialog
          onGenerate={handleGeneratePdf}
          onOpenChange={setPrintDialogOpen}
          open={printDialogOpen}
        />

        {hasError && (
          <div className="text-red-500 dark:text-red-400">
            Failed to load timetable.
          </div>
        )}

        {isLoading ? (
          <div className="w-full">
            <Skeleton className="mb-2 h-8 w-64" />
            <Skeleton className="h-[130px] w-full" />
          </div>
        ) : (
          <TimetableGrid
            activeFilter={activeFilter}
            model={model}
            onColorChange={isAuthenticated ? handleColorChange : undefined}
            userColors={userColors}
          />
        )}
      </div>
    </div>
  );
}
