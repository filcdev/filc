import { Empty } from '@filcdev/ui/components/empty';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { CalendarX } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type z from 'zod';
import { FilterBar } from '@/components/timetable/filter-bar';
import { TimetableGrid } from '@/components/timetable/grid';
import {
  buildViewModel,
  filterLessonsForGroupDisplay,
  filterLessonsForWeek,
  type WeekFilter,
} from '@/components/timetable/helpers';
import { PrintDialog } from '@/components/timetable/print-dialog';
import { TimetableCardView } from '@/components/timetable/secondary';
import type { SecondaryTimetableHeader } from '@/components/timetable/secondary/types';
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
import { useTimetableGroupDisplay } from '@/hooks/timetable-groups';
import {
  useClassrooms,
  useLatestValidTimetable,
  useMyTeacher,
  useTeachers,
  useTimetableCohorts,
  useTimetableLessons,
  useTimetablePeriods,
  useTimetables,
  useTimetableUserSettings,
} from '@/hooks/timetable-public';
import { Route, type searchSchema } from '@/routes/_public/index';
import { useApiMutation } from '@/utils/api';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

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

/** The URL search params that seed the initial filter and selection. */
type TimetableSearchParams = {
  cohort?: string;
  room?: string;
  teacher?: string;
};

/** The filter and entry a selection resolution settled on. */
type ResolvedSelection = { filter: FilterType; id: string };

/** The entries each filter can select from, in the order the API returned them. */
type FilterLists = {
  class: CohortItem[];
  classroom: ClassroomItem[];
  teacher: TeacherItem[];
};

/**
 * The filter and entry encoded in the URL, validated against the loaded
 * reference data: a search param is only honoured while it matches a loaded
 * record. `null` when the URL carries no usable selection.
 */
const resolveSearchSelection = (
  search: TimetableSearchParams,
  lists: FilterLists
): ResolvedSelection | null => {
  if (search.cohort && lists.class.some((item) => item.id === search.cohort)) {
    return { filter: 'class', id: search.cohort };
  }

  if (
    search.teacher &&
    lists.teacher.some((item) => item.id === search.teacher)
  ) {
    return { filter: 'teacher', id: search.teacher };
  }

  if (search.room && lists.classroom.some((item) => item.id === search.room)) {
    return { filter: 'classroom', id: search.room };
  }

  return null;
};

/** Set one filter's selection, leaving the other selections untouched. */
const applySelection = (
  setSelections: Dispatch<SetStateAction<SelectionsType>>,
  filter: FilterType,
  id: string | null
) => {
  setSelections((selections) => {
    switch (filter) {
      case 'class':
        return { ...selections, class: id };
      case 'teacher':
        return { ...selections, teacher: id };
      case 'classroom':
        return { ...selections, classroom: id };
      default:
        return selections;
    }
  });
};

/**
 * Apply the initial filter and selection once the URL, the session and the
 * reference data have resolved. Precedence: a validated search param, then
 * the signed-in teacher's own profile, then a class fallback: the user's own
 * cohort, else the first loaded one.
 */
const applyInitialSelection = (params: {
  fallbackCohortId: string | null;
  lists: FilterLists;
  myTeacher: TeacherItem | null;
  search: TimetableSearchParams;
  setActiveFilter: (filter: FilterType) => void;
  setSelections: Dispatch<SetStateAction<SelectionsType>>;
}) => {
  const {
    fallbackCohortId,
    lists,
    myTeacher,
    search,
    setActiveFilter,
    setSelections,
  } = params;

  const searchSelection = resolveSearchSelection(search, lists);
  if (searchSelection) {
    setActiveFilter(searchSelection.filter);
    applySelection(setSelections, searchSelection.filter, searchSelection.id);
    return;
  }

  if (myTeacher) {
    setActiveFilter('teacher');
    applySelection(setSelections, 'teacher', myTeacher.id);
    return;
  }

  setActiveFilter('class');
  const fallbackId =
    lists.class.find((cohort) => cohort.id === fallbackCohortId)?.id ??
    lists.class[0]?.id ??
    null;
  applySelection(setSelections, 'class', fallbackId);
};

/**
 * The selection to fall back to for the active filter: the first entry of the
 * matching list, unless that filter already has a selection.
 */
const resolveDefaultSelection = (params: {
  filter: FilterType;
  lists: FilterLists;
  selections: SelectionsType;
}): ResolvedSelection | null => {
  const { filter, lists, selections } = params;
  const first = lists[filter][0];
  if (!first || selections[filter]) {
    return null;
  }

  return { filter, id: first.id };
};

/**
 * Derive the header info for the secondary (paper-like) timetable card. Only
 * the class code is shown in the grid's top-left corner cell.
 */
const buildCardHeader = (selectionLabel: string): SecondaryTimetableHeader => ({
  classCode: selectionLabel,
});

type TimetableCardRender = {
  header: SecondaryTimetableHeader;
  language: string | undefined;
  lessons: LessonItem[];
  periods: PeriodItem[];
};

type TimetableGridRender = {
  activeFilter: FilterType;
  groupDisplay: 'highlight' | 'hide' | 'none';
  model: TimetableViewModel;
  handleColorChange?: (subject: string, colorIndex: number) => void;
  isAuthenticated: boolean;
  selectedDivisionTags: Set<string>;
  selectedGroupIds: Set<string>;
  userColors: Record<string, number>;
};

/** Pick the on-screen timetable body: the secondary card view or the grid. */
const renderTimetableBody = (
  view: 'grid' | 'card',
  card: TimetableCardRender,
  grid: TimetableGridRender
) =>
  view === 'card' ? (
    <TimetableCardView
      header={card.header}
      language={card.language}
      lessons={card.lessons}
      periods={card.periods}
    />
  ) : (
    <TimetableGrid
      activeFilter={grid.activeFilter}
      groupDisplay={grid.groupDisplay}
      model={grid.model}
      onColorChange={grid.isAuthenticated ? grid.handleColorChange : undefined}
      selectedDivisionTags={grid.selectedDivisionTags}
      selectedGroupIds={grid.selectedGroupIds}
      userColors={grid.userColors}
    />
  );

// Component
export function TimetableView() {
  const search = Route.useSearch();
  const { i18n, t } = useTranslation();
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();

  const isAuthenticated = !isPending && !!session;

  // Fetch user settings for class colors (authenticated users only)
  const settingsQuery = useTimetableUserSettings(isAuthenticated);
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

  // Timetable query (all timetables)
  const timetablesQuery = useTimetables();

  // Expired timetables stay in the database, but are hidden from the public
  // selector. Current and upcoming timetables remain selectable.
  const visibleTimetables = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');

    return (timetablesQuery.data ?? []).filter(
      (item: TimetableItem) => !item.validTo || item.validTo >= today
    );
  }, [timetablesQuery.data]);

  // The backend is the source of truth for the currently active timetable.
  const latestValidTimetableQuery = useLatestValidTimetable();

  const latestValidTimetableId = latestValidTimetableQuery.data?.id ?? null;

  // Selected timetable — initialised from URL param, else latestValid
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(
    search.timetable ?? null
  );

  // Once we know the latest valid, set it as default if nothing is selected
  useEffect(() => {
    if (!(timetablesQuery.data && latestValidTimetableId)) {
      return;
    }

    const selectedIsVisible =
      selectedTimetableId !== null &&
      visibleTimetables.some((item) => item.id === selectedTimetableId);

    if (!selectedIsVisible) {
      setSelectedTimetableId(latestValidTimetableId);
    }
  }, [
    timetablesQuery.data,
    visibleTimetables,
    selectedTimetableId,
    latestValidTimetableId,
  ]);

  // Queries
  const cohortsQuery = useTimetableCohorts(selectedTimetableId);

  const teachersQuery = useTeachers();

  const classroomsQuery = useClassrooms();

  const periodsQuery = useTimetablePeriods(selectedTimetableId);

  const myTeacherQuery = useMyTeacher(isAuthenticated, session?.user?.id);
  const myTeacher = myTeacherQuery.data ?? null;

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

  const [weekFilter, setWeekFilter] = useState<WeekFilter>('all');

  const [initialized, setInitialized] = useState(false);

  const activeSelectionId = getActiveSelectionId(activeFilter, selections);

  // Fetch lessons
  const lessonsQuery = useTimetableLessons(
    activeFilter,
    activeSelectionId,
    selectedTimetableId
  );

  // Group highlighting applies to a signed-in student viewing their own class.
  const showGroupHandling =
    isAuthenticated &&
    activeFilter === 'class' &&
    selections.class !== null &&
    selections.class === session?.user?.cohortId;
  const { groupDisplay, selectedDivisionTags, selectedGroupIds } =
    useTimetableGroupDisplay(
      showGroupHandling ? selections.class : null,
      showGroupHandling,
      settingsQuery.data?.timetableGroupDisplay
    );

  // Initialize from URL or defaults
  useEffect(() => {
    // The teacher profile loads after auth resolves; wait for it before
    // deciding the default so a teacher isn't defaulted to their class.
    const myTeacherLoaded = !(isAuthenticated && myTeacherQuery.isPending);
    const allDataLoaded =
      cohortsQuery.data &&
      teachersQuery.data &&
      classroomsQuery.data &&
      myTeacherLoaded;

    if (!allDataLoaded || initialized || isPending) {
      return;
    }

    const lists = {
      class: cohortsQuery.data,
      classroom: classroomsQuery.data,
      teacher: teachersQuery.data,
    };

    applyInitialSelection({
      fallbackCohortId: session?.user?.cohortId ?? null,
      lists,
      myTeacher,
      search: {
        cohort: search.cohort,
        room: search.room,
        teacher: search.teacher,
      },
      setActiveFilter,
      setSelections,
    });

    setInitialized(true);
  }, [
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
    session,
    isPending,
    isAuthenticated,
    myTeacher,
    myTeacherQuery.isPending,
    initialized,
    search.cohort,
    search.teacher,
    search.room,
  ]);

  // Set default selection when filter changes
  useEffect(() => {
    if (!initialized) {
      return;
    }

    const defaultSelection = resolveDefaultSelection({
      filter: activeFilter,
      lists: {
        class: cohortsQuery.data ?? [],
        classroom: classroomsQuery.data ?? [],
        teacher: teachersQuery.data ?? [],
      },
      selections: {
        class: selections.class,
        classroom: selections.classroom,
        teacher: selections.teacher,
      },
    });

    if (defaultSelection) {
      applySelection(
        setSelections,
        defaultSelection.filter,
        defaultSelection.id
      );
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
        view: search.view,
      };

      const paramKey = `${activeFilter}` as 'cohort' | 'teacher' | 'room';
      searchParams[paramKey] = activeSelectionId;
      navigate({
        replace: true,
        search: () => searchParams,
      });
    }
  }, [
    activeFilter,
    activeSelectionId,
    selectedTimetableId,
    navigate,
    search.view,
  ]);

  const weekFilteredLessons = useMemo(
    () =>
      filterLessonsForWeek(
        (lessonsQuery.data ?? []) as LessonItem[],
        weekFilter
      ),
    [lessonsQuery.data, weekFilter]
  );

  const model = useMemo(
    () =>
      buildViewModel(
        weekFilteredLessons,
        i18n.language,
        (periodsQuery.data ?? []) as PeriodItem[]
      ),
    [weekFilteredLessons, periodsQuery.data, i18n.language]
  );

  const cardLessons = useMemo(
    () =>
      filterLessonsForGroupDisplay(
        weekFilteredLessons,
        groupDisplay,
        selectedGroupIds,
        selectedDivisionTags
      ),
    [weekFilteredLessons, groupDisplay, selectedGroupIds, selectedDivisionTags]
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
          (entry) => entry.id === selections.teacher
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

  // Secondary (paper-like) view: the class code shown in the corner cell.
  const view = search.view ?? 'grid';
  const cardHeader = buildCardHeader(getSelectionLabel());

  const handleViewChange = (nextView: 'grid' | 'card') => {
    navigate({
      replace: true,
      search: () => ({
        cohort: search.cohort,
        room: search.room,
        teacher: search.teacher,
        timetable: search.timetable,
        view: nextView,
      }),
    });
  };

  const handleGeneratePdf = async (blackAndWhite: boolean): Promise<void> => {
    const timetableName =
      timetablesQuery.data?.find((entry) => entry.id === selectedTimetableId)
        ?.name ?? '';
    const label = getSelectionLabel();
    const generatedAt = new Date().toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // Deliberately dynamic: keeps the heavy PDF renderer out of the entry
    // chunk until the user actually requests a printout.
    const [{ pdf }, { TimetablePDF }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/timetable/pdf/document'),
    ]);

    const blob = await pdf(
      <TimetablePDF
        activeFilter={activeFilter}
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

  const timetableContent = renderTimetableBody(
    view,
    {
      header: cardHeader,
      language: i18n.language,
      lessons: cardLessons,
      periods: (periodsQuery.data ?? []) as PeriodItem[],
    },
    {
      activeFilter,
      groupDisplay,
      handleColorChange,
      isAuthenticated,
      model,
      selectedDivisionTags,
      selectedGroupIds,
      userColors,
    }
  );

  return (
    <div className="flex grow flex-col items-center p-4">
      <div className="flex w-full min-w-0 max-w-7xl flex-col gap-4">
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
          onViewChange={handleViewChange}
          onWeekFilterChange={setWeekFilter}
          selectedByClass={selections.class}
          selectedByRoom={selections.classroom}
          selectedByTeacher={selections.teacher}
          selectedTimetableId={selectedTimetableId}
          selectorLoading={selectorLoading}
          teachers={teachersQuery.data}
          timetables={timetablesQuery.data ? visibleTimetables : undefined}
          view={view}
          weekFilter={weekFilter}
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
          (() => {
            if (!hasError && weekFilteredLessons.length === 0) {
              return (
                <Empty
                  description={t('timetable.emptyWeekDescription')}
                  icon={<CalendarX className="size-6" />}
                  title={t('timetable.emptyWeekTitle')}
                />
              );
            }
            return timetableContent;
          })()
        )}
      </div>
    </div>
  );
}
