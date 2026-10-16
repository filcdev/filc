import { ERROR_CODE } from '@filcdev/api/errors';
import { useSession } from '@filcdev/auth/client';
import { Empty } from '@filcdev/ui/components/empty';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { isDefinedError } from '@orpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { CalendarOff, CalendarX } from 'lucide-react';
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
  type publicTimetableSearchSchema,
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
import { Route } from '@/routes/_public/index';
import { orpc } from '@/utils/orpc';

// Helpers
/** The URL search params that seed the initial filter and selection. */
type TimetableSearchParams = {
  cohort?: string;
  room?: string;
  teacher?: string;
};

/** The filter and entry a selection resolution settled on. */
type ResolvedSelection = { filter: FilterType; id: string | null };

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

/**
 * The initial filter and selection the URL, the session and the reference data
 * imply. Precedence: a validated search param, then the signed-in teacher's own
 * profile, then a class fallback: the user's own cohort, else the first loaded
 * one.
 */
const resolveInitialSelection = (params: {
  fallbackCohortId: string | null;
  lists: FilterLists;
  myTeacher: TeacherItem | null;
  search: TimetableSearchParams;
}): ResolvedSelection => {
  const { fallbackCohortId, lists, myTeacher, search } = params;

  const searchSelection = resolveSearchSelection(search, lists);
  if (searchSelection) {
    return searchSelection;
  }

  if (myTeacher) {
    return { filter: 'teacher', id: myTeacher.id };
  }

  return {
    filter: 'class',
    id:
      lists.class.find((cohort) => cohort.id === fallbackCohortId)?.id ??
      lists.class[0]?.id ??
      null,
  };
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
 * The selection lifecycle: the filter and entry the URL, the session and the
 * loaded lists imply are derived during render, and only the user's own picks
 * are state — so no arriving data has to be written into state. The class is
 * cleared when the timetable changes, because cohorts are scoped to one.
 *
 * The selection state lives here, with the derivations that own it, instead of
 * being passed in and written back by the caller.
 */
const useTimetableSelection = ({
  classrooms,
  cohorts,
  isAuthenticated,
  isPending,
  myTeacher,
  myTeacherPending,
  search,
  selectedTimetableId,
  sessionCohortId,
  teachers,
}: {
  classrooms?: ClassroomItem[];
  cohorts?: CohortItem[];
  isAuthenticated: boolean;
  isPending: boolean;
  myTeacher: TeacherItem | null;
  myTeacherPending: boolean;
  search: TimetableSearchParams;
  selectedTimetableId: string | null;
  sessionCohortId: string | null;
  teachers?: TeacherItem[];
}) => {
  // The user's own picks. An entry the user never picked is derived below, so
  // nothing here is seeded from data arriving.
  const [selections, setSelections] = useState<SelectionsType>({
    class: null,
    classroom: null,
    teacher: null,
  });
  // The filter the user picked, `null` while the view still follows the URL.
  const [filterOverride, setFilterOverride] = useState<FilterType | null>(null);

  const lists: FilterLists = {
    class: cohorts ?? [],
    classroom: classrooms ?? [],
    teacher: teachers ?? [],
  };

  const ready = isSelectionSeedReady({
    classrooms,
    cohorts,
    isAuthenticated,
    isPending,
    myTeacherPending,
    teachers,
  });

  // The filter and entry the URL, the session and the loaded lists imply — or
  // the URL's filter with no entry yet, while its data is still coming in.
  const seed: ResolvedSelection = ready
    ? resolveInitialSelection({
        fallbackCohortId: sessionCohortId,
        lists,
        myTeacher,
        search,
      })
    : { filter: initialFilterFromSearch(search), id: null };

  const activeFilter = filterOverride ?? seed.filter;
  // What the active filter shows: the user's pick, else the seeded entry for
  // the seeded filter, else the first entry of the matching list.
  const activeSelectionId =
    selections[activeFilter] ??
    (seed.filter === activeFilter
      ? seed.id
      : (lists[activeFilter][0]?.id ?? null));

  // Keep the entry the outgoing filter was showing: a default only the URL
  // still names is gone once the URL mirror points at the other filter.
  const setActiveFilter = (filter: FilterType) => {
    setSelections((current) => ({
      ...current,
      [activeFilter]: activeSelectionId,
    }));
    setFilterOverride(filter);
  };

  // Reset the class selection when the timetable changes (cohorts are scoped
  // to a timetable) and follow the seed's filter again. Adjusting state during
  // render — React's pattern for "storing information from previous renders" —
  // instead of mirroring the previous id into state through an effect.
  const [prevTimetableId, setPrevTimetableId] = useState<string | null>(null);
  if (selectedTimetableId && selectedTimetableId !== prevTimetableId) {
    if (prevTimetableId !== null) {
      setSelections((current) => ({ ...current, class: null }));
      setFilterOverride(null);
    }
    setPrevTimetableId(selectedTimetableId);
  }

  return {
    activeFilter,
    activeSelectionId,
    selections: { ...selections, [activeFilter]: activeSelectionId },
    setActiveFilter,
    setSelections,
  };
};

/**
 * Whether every list is in place to seed the selection: all three loaded, auth
 * resolved, and the teacher profile settled (it loads after auth, and a teacher
 * must not be defaulted to their class while it is still pending).
 */
const isSelectionSeedReady = ({
  classrooms,
  cohorts,
  isAuthenticated,
  isPending,
  myTeacherPending,
  teachers,
}: {
  classrooms?: ClassroomItem[];
  cohorts?: CohortItem[];
  isAuthenticated: boolean;
  isPending: boolean;
  myTeacherPending: boolean;
  teachers?: TeacherItem[];
}): boolean =>
  Boolean(cohorts && teachers && classrooms) &&
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
}): z.Infer<typeof publicTimetableSearchSchema> | null => {
  if (!activeSelectionId) {
    return null;
  }

  const params: z.Infer<typeof publicTimetableSearchSchema> = {
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
  // `?? {}` would mint a new object every render, which recreates the colour
  // callback below on every render (react-doctor/exhaustive-deps).
  const userColors = useMemo(
    () =>
      isAuthenticated ? (settingsQuery.data?.timetableClassColors ?? {}) : {},
    [isAuthenticated, settingsQuery.data]
  );

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

/**
 * The timetable list, the backend's currently-valid timetable, and the entry
 * the user is looking at: seeded from the URL, else defaulted to the latest
 * valid timetable that is still visible in the selector.
 */
const useSelectedTimetable = (searchTimetable: string | null) => {
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
    searchTimetable
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
        latestValidTimetableQuery.error.code === ERROR_CODE.NOT_FOUND));

  return {
    allTimetables: timetablesQuery.data,
    hasNoValidTimetable,
    selectedTimetableId,
    setSelectedTimetableId,
    timetables: timetablesQuery.data ? visibleTimetables : undefined,
  };
};

/**
 * `TimetableView`'s data plumbing: the queries, the selection state and the
 * derived view models. The component below only renders what this returns.
 */
function useTimetablePageData() {
  const search = Route.useSearch();
  const { i18n, t } = useTranslation();
  const { data: session, isPending } = useSession();
  const navigate = useNavigate({ from: Route.fullPath });

  const isAuthenticated = !isPending && !!session;

  const settingsQuery = useTimetableUserSettings(isAuthenticated);
  const { handleColorChange, userColors } =
    useTimetableClassColors(isAuthenticated);

  const {
    allTimetables,
    hasNoValidTimetable,
    selectedTimetableId,
    setSelectedTimetableId,
    timetables,
  } = useSelectedTimetable(search.timetable ?? null);

  // Queries
  const cohortsQuery = useTimetableCohorts(selectedTimetableId);

  const teachersQuery = useTeachers();

  const classroomsQuery = useClassrooms();

  const periodsQuery = useTimetablePeriods(selectedTimetableId);

  const myTeacherQuery = useMyTeacher(isAuthenticated, session?.user?.id);
  const myTeacher = myTeacherQuery.data ?? null;

  // Selection plumbing: the hook owns the filter, the selected entries and the
  // seed flag, seeding from the URL and following filter/timetable changes.
  const {
    activeFilter,
    activeSelectionId,
    selections,
    setActiveFilter,
    setSelections,
  } = useTimetableSelection({
    classrooms: classroomsQuery.data,
    cohorts: cohortsQuery.data,
    isAuthenticated,
    isPending,
    myTeacher,
    myTeacherPending: myTeacherQuery.isPending,
    search: {
      cohort: search.cohort,
      room: search.room,
      teacher: search.teacher,
    },
    selectedTimetableId,
    sessionCohortId: session?.user?.cohortId ?? null,
    teachers: teachersQuery.data,
  });

  const [weekFilter, setWeekFilter] = useState<WeekFilter>('all');

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
      allTimetables?.find((entry) => entry.id === selectedTimetableId)?.name ??
      '';
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

  const isLoading =
    selectorLoading || lessonsQuery.isLoading || !activeSelectionId;
  const hasError = Boolean(
    cohortsQuery.error ??
      teachersQuery.error ??
      classroomsQuery.error ??
      lessonsQuery.error
  );

  return {
    activeFilter,
    cardHeader,
    cardLessons,
    classrooms: classroomsQuery.data,
    cohorts: cohortsQuery.data,
    groupDisplay,
    handleColorChange,
    handleGeneratePdf,
    hasError,
    hasNoValidTimetable,
    isAuthenticated,
    isLoading,
    language: i18n.language,
    lessonCount: weekFilteredLessons.length,
    model,
    periods: (periodsQuery.data ?? []) as PeriodItem[],
    selectedDivisionTags,
    selectedGroupIds,
    selectedTimetableId,
    selections,
    selectorLoading,
    setActiveFilter,
    setSelectedTimetableId,
    setSelections,
    setWeekFilter,
    t,
    teachers: teachersQuery.data,
    timetables,
    userColors,
    view,
    weekFilter,
  };
}

// Component
export function TimetableView() {
  const {
    activeFilter,
    cardHeader,
    cardLessons,
    classrooms,
    cohorts,
    groupDisplay,
    handleColorChange,
    handleGeneratePdf,
    hasError,
    hasNoValidTimetable,
    isAuthenticated,
    isLoading,
    language,
    lessonCount,
    model,
    periods,
    selectedDivisionTags,
    selectedGroupIds,
    selectedTimetableId,
    selections,
    selectorLoading,
    setActiveFilter,
    setSelectedTimetableId,
    setSelections,
    setWeekFilter,
    t,
    teachers,
    timetables,
    userColors,
    view,
    weekFilter,
  } = useTimetablePageData();

  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  const timetableContent = renderTimetableBody(
    view,
    {
      header: cardHeader,
      language,
      lessons: cardLessons,
      periods,
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

    if (!hasError && lessonCount === 0) {
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
          classrooms={classrooms}
          cohorts={cohorts}
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
          teachers={teachers}
          timetables={timetables}
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
