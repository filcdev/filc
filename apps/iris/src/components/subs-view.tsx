import type { InferResponseType } from 'hono/client';
import {
  Building2,
  CheckIcon,
  ChevronsUpDownIcon,
  GraduationCap,
  UserRound,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NewsPanel } from '@/components/news-panel';
import type {
  ClassroomItem,
  CohortItem,
  FilterType,
  SelectionsType,
  TeacherItem,
  TimetableItem,
} from '@/components/timetable/types';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils';
import { useApiQuery } from '@/utils/api';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';
import { SubsV } from './subs';

type SubstitutionsResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;

type Subs = NonNullable<SubstitutionsResponse['data']>[number];

type MovedLessonApiResponse = InferResponseType<
  typeof api.timetable.movedLessons.$get
>;
type MovedLessonItem = NonNullable<MovedLessonApiResponse['data']>[number];

const QUERY_OPTIONS = {
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: Number.POSITIVE_INFINITY,
};

const groupByDate = (data: Subs[]) =>
  data.reduce(
    (acc, curr) => {
      const date = curr.substitution.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(curr);
      return acc;
    },
    {} as Record<string, Subs[]>
  );

const groupMovedLessonsByDate = (data: MovedLessonItem[]) =>
  data.reduce(
    (acc, curr) => {
      const date = curr.movedLesson.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(curr);
      return acc;
    },
    {} as Record<string, MovedLessonItem[]>
  );

// Filter helpers

const teacherLabel = (teacher: TeacherItem, fallback: string): string =>
  `${teacher.firstName} ${teacher.lastName}`.trim() || fallback;

const getFilterOptions = (
  activeFilter: FilterType,
  options: {
    cohorts?: CohortItem[];
    teachers?: TeacherItem[];
    classrooms?: ClassroomItem[];
    translate: (key: string) => string;
  }
): { label: string; value: string }[] => {
  const { cohorts, teachers, classrooms, translate } = options;
  if (activeFilter === 'class') {
    return (cohorts ?? []).map((c) => ({ label: c.name, value: c.id }));
  }
  if (activeFilter === 'teacher') {
    return (teachers ?? []).map((teacher) => ({
      label: teacherLabel(teacher, translate('timetable.teacherFallback')),
      value: teacher.id,
    }));
  }
  return (classrooms ?? []).map((c) => ({ label: c.name, value: c.id }));
};

const getPlaceholder = (
  activeFilter: FilterType,
  translate: (key: string) => string
): string => {
  const placeholders = {
    class: 'timetable.selectClass',
    classroom: 'timetable.selectClassroom',
    teacher: 'timetable.selectTeacher',
  };
  return translate(placeholders[activeFilter]);
};

const getSearchPlaceholder = (
  activeFilter: FilterType,
  translate: (key: string) => string
): string => {
  const placeholders = {
    class: 'timetable.searchClass',
    classroom: 'timetable.searchClassroom',
    teacher: 'timetable.searchTeacher',
  };
  return translate(placeholders[activeFilter]);
};

const getEmptyMessage = (
  activeFilter: FilterType,
  translate: (key: string) => string
): string => {
  const messages = {
    class: 'timetable.noClassFound',
    classroom: 'timetable.noClassroomFound',
    teacher: 'timetable.noTeacherFound',
  };
  return translate(messages[activeFilter]);
};

const getSelectedValue = (filter: FilterType, sel: SelectionsType): string => {
  if (filter === 'class') {
    return sel.class ?? '';
  }
  if (filter === 'teacher') {
    return sel.teacher ?? '';
  }
  return sel.classroom ?? '';
};

const getActiveSelectionId = (
  filter: FilterType,
  selections: SelectionsType
): string | null => {
  if (filter === 'class') {
    return selections.class;
  }
  if (filter === 'teacher') {
    return selections.teacher;
  }
  return selections.classroom;
};

const getSelectorLoading = (
  filter: FilterType,
  cohortsLoading: boolean,
  teachersLoading: boolean,
  classroomsLoading: boolean
): boolean => {
  if (filter === 'class') {
    return cohortsLoading;
  }
  if (filter === 'teacher') {
    return teachersLoading;
  }
  return classroomsLoading;
};

const lessonMatchesFilter = (
  lesson: NonNullable<Subs['lessons'][number]>,
  activeFilter: FilterType,
  selectionId: string,
  cohorts: CohortItem[] | undefined
): boolean => {
  if (activeFilter === 'class') {
    const cohortName = cohorts?.find((c) => c.id === selectionId)?.name;
    return cohortName ? lesson.cohorts.includes(cohortName) : false;
  }
  if (activeFilter === 'teacher') {
    return (
      lesson.teachers?.some((teacher) => teacher.id === selectionId) ?? false
    );
  }
  return lesson.classrooms?.some((c) => c.id === selectionId) ?? false;
};

const filterSubs = (
  data: Subs[],
  activeFilter: FilterType,
  selectionId: string | null,
  cohorts: CohortItem[] | undefined
): Subs[] => {
  if (!selectionId) {
    return data;
  }
  return data.filter((sub) => {
    if (activeFilter === 'teacher' && sub.teacher?.id === selectionId) {
      return true;
    }
    return sub.lessons.some((lesson) => {
      if (!lesson) {
        return false;
      }
      return lessonMatchesFilter(lesson, activeFilter, selectionId, cohorts);
    });
  });
};

const filterMovedLessons = (
  data: MovedLessonItem[],
  activeFilter: FilterType,
  selectionId: string | null
): MovedLessonItem[] => {
  if (!selectionId) {
    return data;
  }
  if (activeFilter !== 'classroom') {
    return [];
  }
  return data.filter((ml) => ml.classroom?.id === selectionId);
};

const getCohortsForDate = (subs: Subs[]): string[] =>
  [
    ...new Set(
      subs.flatMap((sub) =>
        sub.lessons.flatMap((lesson) => lesson?.cohorts ?? [])
      )
    ),
  ].sort();

// SubsFilterBar

function SubsFilterBar({
  activeFilter,
  onFilterChange,
  cohorts,
  teachers,
  classrooms,
  selections,
  onSelectClass,
  onSelectTeacher,
  onSelectRoom,
  onClear,
  selectorLoading,
}: {
  activeFilter: FilterType;
  onFilterChange: (value: FilterType) => void;
  cohorts?: CohortItem[];
  teachers?: TeacherItem[];
  classrooms?: ClassroomItem[];
  selections: SelectionsType;
  onSelectClass: (value: string) => void;
  onSelectTeacher: (value: string) => void;
  onSelectRoom: (value: string) => void;
  onClear?: () => void;
  selectorLoading: boolean;
}) {
  const { t } = useTranslation();
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const selectedValue = getSelectedValue(activeFilter, selections);
  const selectWidthClassName =
    activeFilter === 'class' ? 'w-36 sm:w-44' : 'w-40 sm:w-52';

  const filterOptions = getFilterOptions(activeFilter, {
    classrooms,
    cohorts,
    teachers,
    translate: t,
  });

  const placeholderLabel = getPlaceholder(activeFilter, t);
  const selectedLabel =
    filterOptions.find((option) => option.value === selectedValue)?.label ??
    placeholderLabel;

  const handleSelection = (value: string) => {
    setComboboxOpen(false);
    const handlers = {
      class: onSelectClass,
      classroom: onSelectRoom,
      teacher: onSelectTeacher,
    };
    handlers[activeFilter](value);
  };

  const renderSelect = () => {
    if (selectorLoading) {
      return <Skeleton className={`h-9 ${selectWidthClassName}`} />;
    }

    const filterSelectId = `subs-filter-${activeFilter}`;
    const comboboxContentId = `${filterSelectId}-content`;

    return (
      <Popover onOpenChange={setComboboxOpen} open={comboboxOpen}>
        <PopoverTrigger
          render={
            <Button
              aria-controls={comboboxContentId}
              aria-expanded={comboboxOpen}
              className={`h-9 ${selectWidthClassName} justify-between`}
              id={filterSelectId}
              role="combobox"
              size="sm"
              variant="outline"
            >
              <span className="truncate">{selectedLabel}</span>
              <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent
          className="w-[var(--radix-popper-anchor-width)] p-0"
          id={comboboxContentId}
        >
          <Command>
            <CommandInput placeholder={getSearchPlaceholder(activeFilter, t)} />
            <CommandList>
              <CommandEmpty>{getEmptyMessage(activeFilter, t)}</CommandEmpty>
              <CommandGroup>
                {filterOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelection(option.value)}
                    value={option.label}
                  >
                    <CheckIcon
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedValue === option.value
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonGroup>
        <Button
          disabled={activeFilter === 'class'}
          onClick={() => onFilterChange('class')}
          variant="outline"
        >
          <GraduationCap /> {t('timetable.filterByClass')}
        </Button>
        <Button
          disabled={activeFilter === 'teacher'}
          onClick={() => onFilterChange('teacher')}
          variant="outline"
        >
          <UserRound /> {t('timetable.filterByTeacher')}
        </Button>
        <Button
          disabled={activeFilter === 'classroom'}
          onClick={() => onFilterChange('classroom')}
          variant="outline"
        >
          <Building2 /> {t('timetable.filterByClassroom')}
        </Button>
      </ButtonGroup>
      <div className="flex items-center gap-1">
        {renderSelect()}
        {selectedValue && onClear && (
          <Button
            aria-label={t('timetable.clearFilter')}
            className="h-9 w-9 p-0"
            onClick={onClear}
            size="sm"
            variant="ghost"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// SubstitutionView

export function SubstitutionView() {
  const { isPending } = authClient.useSession();
  const { t } = useTranslation();

  const [activeFilter, setActiveFilter] = useState<FilterType>('class');
  const [selections, setSelections] = useState<SelectionsType>({
    class: null,
    classroom: null,
    teacher: null,
  });

  const timetablesQuery = useApiQuery<TimetableItem[]>(
    () => api.timetable.timetables.$get(),
    { ...QUERY_OPTIONS, queryKey: queryKeys.timetables.all() }
  );

  const latestValidTimetableQuery = useApiQuery<TimetableItem | null>(
    () => api.timetable.timetables.latestValid.$get(),
    { ...QUERY_OPTIONS, queryKey: queryKeys.timetables.latestValid() }
  );

  const latestTimetableId =
    latestValidTimetableQuery.data?.id ?? timetablesQuery.data?.[0]?.id ?? null;

  const cohortsQuery = useApiQuery<CohortItem[]>(
    () => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const timetableId = latestTimetableId!;
      return api.timetable.cohorts.getAllForTimetable[':timetableId'].$get({
        param: { timetableId },
      });
    },
    {
      ...QUERY_OPTIONS,
      enabled: !!latestTimetableId,
      queryKey: queryKeys.timetable.cohorts(latestTimetableId),
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

  const substitutionsQuery = useApiQuery<Subs[]>(
    () => api.timetable.substitutions.$get(),
    { enabled: !isPending, queryKey: queryKeys.substitutions() }
  );

  const movedLessonsQuery = useApiQuery<MovedLessonItem[]>(
    () => api.timetable.movedLessons.$get(),
    { enabled: !isPending, queryKey: queryKeys.movedLessons() }
  );

  const activeSelectionId = getActiveSelectionId(activeFilter, selections);

  const filteredSubs = filterSubs(
    substitutionsQuery.data ?? [],
    activeFilter,
    activeSelectionId,
    cohortsQuery.data
  );

  const filteredMovedLessons = filterMovedLessons(
    movedLessonsQuery.data ?? [],
    activeFilter,
    activeSelectionId
  );

  const isLoading =
    substitutionsQuery.isLoading ||
    substitutionsQuery.isFetching ||
    movedLessonsQuery.isLoading ||
    movedLessonsQuery.isFetching;
  const hasError = substitutionsQuery.error || movedLessonsQuery.error;

  const groupedData = groupByDate(filteredSubs);
  const groupedMovedLessons = groupMovedLessonsByDate(filteredMovedLessons);

  const allDates = Array.from(
    new Set([...Object.keys(groupedData), ...Object.keys(groupedMovedLessons)])
  ).sort((a, b) => a.localeCompare(b));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasFutureSubstitutions =
    filteredSubs.some((sub) => new Date(sub.substitution.date) >= today) ||
    filteredMovedLessons.some((ml) => new Date(ml.movedLesson.date) >= today);

  const selectorLoading = getSelectorLoading(
    activeFilter,
    cohortsQuery.isLoading,
    teachersQuery.isLoading,
    classroomsQuery.isLoading
  );

  const renderDateCards = (date: string) => {
    const dateSubs = groupedData[date] ?? [];
    const dateMovedLessons = groupedMovedLessons[date] ?? [];
    const cohorts = getCohortsForDate(dateSubs);

    if (cohorts.length === 0) {
      return [
        <SubsV
          data={dateSubs}
          date={date}
          key={date}
          movedLessons={dateMovedLessons}
        />,
      ];
    }

    const cohortCards = cohorts.map((cohort) => (
      <SubsV
        cohortFilter={cohort}
        data={dateSubs.filter((sub) =>
          sub.lessons.some((l) => l?.cohorts.includes(cohort))
        )}
        key={`${date}-${cohort}`}
      />
    ));

    const movedCard =
      dateMovedLessons.length > 0 ? (
        <SubsV
          data={[]}
          date={date}
          key={`${date}-moved`}
          movedLessons={dateMovedLessons}
        />
      ) : null;

    return [...cohortCards, movedCard].filter(Boolean);
  };

  return (
    <div className="flex grow flex-col items-center gap-6 p-6">
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl text-foreground tracking-tight">
              {t('substitution.title')}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t('substitution.description')}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <SubsFilterBar
            activeFilter={activeFilter}
            classrooms={classroomsQuery.data}
            cohorts={cohortsQuery.data}
            onClear={() =>
              setSelections(
                (s) => ({ ...s, [activeFilter]: null }) as SelectionsType
              )
            }
            onFilterChange={setActiveFilter}
            onSelectClass={(id) => setSelections((s) => ({ ...s, class: id }))}
            onSelectRoom={(id) =>
              setSelections((s) => ({ ...s, classroom: id }))
            }
            onSelectTeacher={(id) =>
              setSelections((s) => ({ ...s, teacher: id }))
            }
            selections={selections}
            selectorLoading={selectorLoading}
            teachers={teachersQuery.data}
          />
        </div>
      </div>
      <NewsPanel />
      {isLoading && (
        <div className="w-full max-w-5xl">
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      )}
      {hasError && (
        <div className="w-full max-w-5xl rounded-lg border border-destructive/50 bg-destructive/10 p-6">
          <p className="font-medium text-destructive">
            {t('substitution.loadError')}
          </p>
          <p className="mt-2 text-muted-foreground text-sm">
            {t('substitution.loadErrorMessage')}
          </p>
        </div>
      )}
      <div className="w-full max-w-5xl space-y-4">
        {!(isLoading || hasError) && hasFutureSubstitutions
          ? allDates.flatMap((date) => renderDateCards(date))
          : !(isLoading || hasError) && (
              <div className="rounded-lg border border-muted-foreground/30 border-dashed bg-muted/30 p-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <p className="font-medium text-foreground text-lg">
                    {t('substitution.noSubstitutions')}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {t('substitution.description')}
                  </p>
                </div>
              </div>
            )}
      </div>
    </div>
  );
}
