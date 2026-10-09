import { useSession } from '@filcdev/auth/client';
import { Empty } from '@filcdev/ui/components/empty';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { isDefinedError } from '@orpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { CalendarOff, CalendarX } from 'lucide-react';
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
import { useTimetableView } from '@/hooks/use-timetable-view';
import { Route, type searchSchema } from '@/routes/_public/index';
import { orpc } from '@/utils/orpc';

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

/**
 * A placeholder shaped like the timetable it stands in for. The old
 * `h-8 w-64` strip read as a second, empty toolbar sitting under the real one.
 * Colours match the real grid (`border-border bg-card`) — a bare `border`
 * resolves to `currentColor`, which drew a white outline around the card.
 */
function TimetableLoadingPlaceholder() {
  return (
    <div className="w-full rounded-xl border border-border bg-card">
      <div className="border-border border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-5 gap-px p-px">
        {[0, 1, 2, 3, 4].map((day) => (
          <div className="space-y-2 p-2" key={day}>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The selection lifecycle: seed the filter and entry from the URL or sensible
 * defaults once every list has loaded, keep the selection valid when the filter
 * changes, clear the class when the timetable changes (cohorts are scoped to a
 * timetable), and mirror the result back into the URL.
 *
 * A hook rather than four effects in the page component: the ordering between
 * them is the whole point, and it is easier to follow in one place.
 */
const useTimetableSelection = ({
  activeFilter,
  activeSelectionId,
  classrooms,
  cohorts,
  initialized,
  isAuthenticated,
  isPending,
  myTeacher,
  myTeacherPending,
  navigate,
  search,
  selectedTimetableId,
  selections,
  sessionCohortId,
  setActiveFilter,
  setInitialized,
  setSelections,
  teachers,
}: {
  activeFilter: FilterType;
  activeSelectionId: string | null;
  classrooms?: ClassroomItem[];
  cohorts?: CohortItem[];
  initialized: boolean;
  isAuthenticated: boolean;
  isPending: boolean;
  myTeacher: TeacherItem | null;
  myTeacherPending: boolean;
  navigate: (options: {
    replace: boolean;
    search: () => z.Infer<typeof searchSchema>;
  }) => void;
  search: TimetableSearchParams;
  selectedTimetableId: string | null;
  selections: SelectionsType;
  sessionCohortId: string | null;
  setActiveFilter: (filter: FilterType) => void;
  setInitialized: (initialized: boolean) => void;
  setSelections: Dispatch<SetStateAction<SelectionsType>>;
  teachers?: TeacherItem[];
}) => {
  // Seed from the URL, or the user's own class/teacher profile.
  useEffect(() => {
    const ready = isSelectionSeedReady({
      classrooms,
      cohorts,
      initialized,
      isAuthenticated,
      isPending,
      myTeacherPending,
      teachers,
    });

    if (!ready) {
      return;
    }

    applyInitialSelection({
      fallbackCohortId: sessionCohortId,
      lists: {
        class: cohorts ?? [],
        classroom: classrooms ?? [],
        teacher: teachers ?? [],
      },
      myTeacher,
      search,
      setActiveFilter,
      setSelections,
    });

    setInitialized(true);
  }, [
    classrooms,
    cohorts,
    teachers,
    sessionCohortId,
    isPending,
    isAuthenticated,
    myTeacher,
    myTeacherPending,
    initialized,
    search,
    setActiveFilter,
    setInitialized,
    setSelections,
  ]);

  // Keep a valid entry selected when the filter changes.
  useEffect(() => {
    if (!initialized) {
      return;
    }

    const defaultSelection = resolveDefaultSelection({
      filter: activeFilter,
      lists: {
        class: cohorts ?? [],
        classroom: classrooms ?? [],
        teacher: teachers ?? [],
      },
      selections,
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
    classrooms,
    cohorts,
    teachers,
    selections,
    setSelections,
  ]);

  // Reset the class selection when the timetable changes.
  const [prevTimetableId, setPrevTimetableId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedTimetableId || selectedTimetableId === prevTimetableId) {
      return;
    }
    if (prevTimetableId !== null) {
      setSelections((current) => ({ ...current, class: null }));
      setInitialized(false);
    }
    setPrevTimetableId(selectedTimetableId);
  }, [selectedTimetableId, prevTimetableId, setInitialized, setSelections]);

  // Mirror the selection into the URL so a link is shareable.
  useEffect(() => {
    const params = buildSelectionSearch({
      activeFilter,
      activeSelectionId,
      selectedTimetableId,
    });
    if (params) {
      navigate({ replace: true, search: () => params });
    }
  }, [activeFilter, activeSelectionId, selectedTimetableId, navigate]);
};

/**
 * Whether every list is in place to seed the selection: all three loaded, auth
 * resolved, and the teacher profile settled (it loads after auth, and a teacher
 * must not be defaulted to their class while it is still pending).
 */
const isSelectionSeedReady = ({
  classrooms,
  cohorts,
  initialized,
  isAuthenticated,
  isPending,
  myTeacherPending,
  teachers,
}: {
  classrooms?: ClassroomItem[];
  cohorts?: CohortItem[];
  initialized: boolean;
  isAuthenticated: boolean;
  isPending: boolean;
  myTeacherPending: boolean;
  teachers?: TeacherItem[];
}): boolean =>
  Boolean(cohorts && teachers && classrooms) &&
  !initialized &&
  !isPending &&
  !(isAuthenticated && myTeacherPending);

/** Whether the picker for the active filter is still loading. */
const isSelectorLoading = (
  activeFilter: FilterType,
  loading: { classrooms: boolean; cohorts: boolean; teachers: boolean }
): boolean => {
  switch (activeFilter) {
    case 'class':
      return loading.cohorts;
    case 'teacher':
      return loading.teachers;
    case 'classroom':
      return loading.classrooms;
    default:
      return false;
  }
};

/**
 * The search params for the current selection, or `null` when there is nothing
 * selected to put in the URL.
 */
const buildSelectionSearch = ({
  activeFilter,
  activeSelectionId,
  selectedTimetableId,
}: {
  activeFilter: FilterType;
  activeSelectionId: string | null;
  selectedTimetableId: string | null;
}): z.Infer<typeof searchSchema> | null => {
  if (!activeSelectionId) {
    return null;
  }

  const params: z.Infer<typeof searchSchema> = {
    cohort: undefined,
    room: undefined,
    teacher: undefined,
    timetable: selectedTimetableId ?? undefined,
  };
  const paramKey = `${activeFilter}` as 'cohort' | 'teacher' | 'room';
  params[paramKey] = activeSelectionId;
  return params;
};

/**
 * The signed-in user's per-subject colours, and the writer for them.
 *
 * Anonymous visitors get an empty map (there is nothing to load and nothing to
 * save); the mutation invalidates the shared settings query so the picker and
 * the grid stay in step.
 */
const useTimetableClassColors = (isAuthenticated: boolean) => {
  const queryClient = useQueryClient();
  const settingsQuery = useTimetableUserSettings(isAuthenticated);
  const userColors = isAuthenticated
    ? (settingsQuery.data?.timetableClassColors ?? {})
    : {};

  const colorMutation = useMutation(
    orpc.notifications.updateSettings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.notifications.settings.key(),
        });
      },
    })
  );

  const handleColorChange = useCallback(
    (subject: string, colorIndex: number) => {
      colorMutation.mutate({
        timetableClassColors: { ...userColors, [subject]: colorIndex },
      });
    },
    [colorMutation, userColors]
  );

  return { handleColorChange, userColors };
};

/** The filter a URL implies, when it names one of the three entry types. */
const initialFilterFromSearch = (search: TimetableSearchParams): FilterType => {
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
};

/**
 * Whether group highlighting applies: a signed-in student looking at their own
 * class. Any other combination shows the plain timetable.
 */
const isShowingOwnClass = ({
  activeFilter,
  isAuthenticated,
  selectedClassId,
  sessionCohortId,
}: {
  activeFilter: FilterType;
  isAuthenticated: boolean;
  selectedClassId: string | null;
  sessionCohortId: string | null;
}): boolean =>
  isAuthenticated &&
  activeFilter === 'class' &&
  selectedClassId !== null &&
  selectedClassId === sessionCohortId;

/** The name of the entry the current filter points at, for the card header. */
const resolveSelectionLabel = (
  activeFilter: FilterType,
  {
    classrooms,
    cohorts,
    selections,
    teachers,
  }: {
    classrooms?: ClassroomItem[];
    cohorts?: CohortItem[];
    selections: SelectionsType;
    teachers?: TeacherItem[];
  }
): string => {
  switch (activeFilter) {
    case 'class':
      return (
        cohorts?.find((entry) => entry.id === selections.class)?.name ?? ''
      );
    case 'teacher': {
      const teacher = teachers?.find(
        (entry) => entry.id === selections.teacher
      );
      return teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : '';
    }
    case 'classroom':
      return (
        classrooms?.find((entry) => entry.id === selections.classroom)?.name ??
        ''
      );
    default:
      return '';
  }
};

// Component
export function TimetableView() {
  const search = Route.useSearch();
  const { i18n, t } = useTranslation();
  const { data: session, isPending } = useSession();
  const navigate = useNavigate({ from: Route.fullPath });

  const isAuthenticated = !isPending && !!session;

  const settingsQuery = useTimetableUserSettings(isAuthenticated);
  const { handleColorChange, userColors } =
    useTimetableClassColors(isAuthenticated);

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
  const [activeFilter, setActiveFilter] = useState<FilterType>(() =>
    initialFilterFromSearch(search)
  );
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
  const showGroupHandling = isShowingOwnClass({
    activeFilter,
    isAuthenticated,
    selectedClassId: selections.class,
    sessionCohortId: session?.user?.cohortId ?? null,
  });
  const { groupDisplay, selectedDivisionTags, selectedGroupIds } =
    useTimetableGroupDisplay(
      showGroupHandling ? selections.class : null,
      showGroupHandling,
      settingsQuery.data?.timetableGroupDisplay
    );

  // Selection plumbing: seed from the URL, follow filter changes, reset when
  // the timetable changes, and mirror the selection back into the URL.
  useTimetableSelection({
    activeFilter,
    activeSelectionId,
    classrooms: classroomsQuery.data,
    cohorts: cohortsQuery.data,
    initialized,
    isAuthenticated,
    isPending,
    myTeacher,
    myTeacherPending: myTeacherQuery.isPending,
    navigate,
    search: {
      cohort: search.cohort,
      room: search.room,
      teacher: search.teacher,
    },
    selectedTimetableId,
    selections,
    sessionCohortId: session?.user?.cohortId ?? null,
    setActiveFilter,
    setInitialized,
    setSelections,
    teachers: teachersQuery.data,
  });

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

  // Secondary (paper-like) view: the class code shown in the corner cell.
  // The view itself is a preference (see the Appearance settings pane), kept in
  // a cookie so it applies before the first paint.
  const { view } = useTimetableView(settingsQuery.data?.timetableView);
  const cardHeader = buildCardHeader(
    resolveSelectionLabel(activeFilter, {
      classrooms: classroomsQuery.data,
      cohorts: cohortsQuery.data,
      selections,
      teachers: teachersQuery.data,
    })
  );

  const handleGeneratePdf = async (blackAndWhite: boolean): Promise<void> => {
    const timetableName =
      timetablesQuery.data?.find((entry) => entry.id === selectedTimetableId)
        ?.name ?? '';
    const label = resolveSelectionLabel(activeFilter, {
      classrooms: classroomsQuery.data,
      cohorts: cohortsQuery.data,
      selections,
      teachers: teachersQuery.data,
    });
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

  const selectorLoading = isSelectorLoading(activeFilter, {
    classrooms: classroomsQuery.isLoading,
    cohorts: cohortsQuery.isLoading,
    teachers: teachersQuery.isLoading,
  });

  /**
   * No current timetable: the backend answers `latestValid` with NOT_FOUND when
   * nothing is valid today. Without this branch the page would sit on the
   * skeletons below forever, because `isLoading` stays true while no selection
   * can ever be resolved. An explicit selection (a `?timetable=` param naming a
   * still-loadable timetable) is left alone.
   */
  const hasNoValidTimetable =
    selectedTimetableId === null &&
    (latestValidTimetableQuery.data === null ||
      (isDefinedError(latestValidTimetableQuery.error) &&
        latestValidTimetableQuery.error.code === 'NOT_FOUND'));

  const isLoading =
    selectorLoading || lessonsQuery.isLoading || !activeSelectionId;
  const hasError = Boolean(
    cohortsQuery.error ??
      teachersQuery.error ??
      classroomsQuery.error ??
      lessonsQuery.error
  );

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

  /**
   * Which body to show. An early return per state keeps this out of the JSX as
   * a chain of ternaries, and keeps the component's own branching to a minimum.
   */
  const renderBody = () => {
    if (hasNoValidTimetable) {
      return (
        <Empty
          description={t('timetable.noValidTimetableDescription')}
          icon={<CalendarOff className="size-6" />}
          title={t('timetable.noValidTimetableTitle')}
        />
      );
    }

    if (isLoading) {
      return <TimetableLoadingPlaceholder />;
    }

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
  };

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
          onWeekFilterChange={setWeekFilter}
          selectedByClass={selections.class}
          selectedByRoom={selections.classroom}
          selectedByTeacher={selections.teacher}
          selectedTimetableId={selectedTimetableId}
          selectorLoading={selectorLoading}
          teachers={teachersQuery.data}
          timetables={timetablesQuery.data ? visibleTimetables : undefined}
          weekFilter={weekFilter}
        />

        <PrintDialog
          onGenerate={handleGeneratePdf}
          onOpenChange={setPrintDialogOpen}
          open={printDialogOpen}
        />

        {hasError && (
          <div className="text-red-500 dark:text-red-400">
            {t('timetable.loadError')}
          </div>
        )}

        {renderBody()}
      </div>
    </div>
  );
}
