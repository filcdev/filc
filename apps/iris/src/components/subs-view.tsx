import { Button } from '@filcdev/ui/components/button';
import { ButtonGroup } from '@filcdev/ui/components/button-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@filcdev/ui/components/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@filcdev/ui/components/popover';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import { cn } from '@filcdev/ui/lib/utils';
import {
  Building2,
  CalendarDays,
  CheckIcon,
  ChevronsUpDownIcon,
  GraduationCap,
  UserRound,
  XIcon,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ClassroomItem,
  CohortItem,
  FilterType,
  SelectionsType,
  TeacherItem,
} from '@/components/timetable/types';
import type { MovedLessonItem } from '@/hooks/moved-lessons';
import { type AnnouncementItem, useAnnouncementsPanel } from '@/hooks/news';
import type { SubstitutionItem as Subs } from '@/hooks/substitutions';
import {
  useClassrooms,
  useLatestValidTimetable,
  useMyTeacher,
  usePublicMovedLessons,
  usePublicSubstitutions,
  useTeachers,
  useTimetableCohorts,
  useTimetables,
} from '@/hooks/timetable-public';
import { authClient } from '@/utils/authentication';
import { compareClassNames } from '@/utils/cohort';
import { formatLocalizedDate, parseDateOnly } from '@/utils/date-locale';
import { DayNews } from './news-panel';
import { SubsV } from './subs';

/** Local calendar day as `YYYY-MM-DD`; the key format used for date sections. */
const toDateKey = (value: string | Date): string => {
  const date = value instanceof Date ? value : parseDateOnly(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const groupByDate = (data: Subs[]) =>
  data.reduce(
    (acc, curr) => {
      const date = toDateKey(curr.substitution.date);
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
      const date = toDateKey(curr.movedLesson.date);
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

const getActiveCohortName = (
  activeFilter: FilterType,
  selectionId: string | null,
  cohorts: CohortItem[] | undefined
): string | null => {
  if (activeFilter !== 'class' || !selectionId) {
    return null;
  }
  return cohorts?.find((c) => c.id === selectionId)?.name ?? null;
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
  if (activeFilter === 'class') {
    const cohortName = cohorts?.find((c) => c.id === selectionId)?.name;
    if (!cohortName) {
      return [];
    }
    return data
      .map((sub) => ({
        ...sub,
        lessons: sub.lessons.filter((lesson) =>
          lesson?.cohorts.includes(cohortName)
        ),
      }))
      .filter((sub) => sub.lessons.length > 0);
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
  selectionId: string | null,
  cohorts: CohortItem[] | undefined
): MovedLessonItem[] => {
  if (!selectionId) {
    return data;
  }
  if (activeFilter === 'class') {
    const cohortName = cohorts?.find((c) => c.id === selectionId)?.name;
    if (!cohortName) {
      return [];
    }
    return data
      .map((ml) => ({
        ...ml,
        lessons: ml.lessons.filter((lesson) =>
          lesson.cohorts.includes(cohortName)
        ),
      }))
      .filter((ml) => ml.lessons.length > 0);
  }
  if (activeFilter === 'teacher') {
    return data
      .map((ml) => ({
        ...ml,
        lessons: ml.lessons.filter((lesson) =>
          lesson.teachers.some((teacher) => teacher.id === selectionId)
        ),
      }))
      .filter((ml) => ml.lessons.length > 0);
  }
  return data.filter((ml) => ml.classroom?.id === selectionId);
};

const getAnnouncementsForDay = (
  announcements: AnnouncementItem[] | undefined,
  date: string,
  classId: string | null
): AnnouncementItem[] => {
  if (!announcements?.length) {
    return [];
  }
  const start = parseDateOnly(date);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return announcements
    .filter((a) => {
      const from = new Date(a.validFrom);
      const until = new Date(a.validUntil);
      if (from > end || until < start) {
        return false;
      }
      return (
        !classId || a.cohortIds.length === 0 || a.cohortIds.includes(classId)
      );
    })
    .sort(
      (a, b) =>
        new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime()
    );
};

const getAnnouncementDates = (
  announcements: AnnouncementItem[],
  classId: string | null,
  today: Date,
  now: Date
): string[] =>
  announcements
    .filter(
      (announcement) =>
        !classId ||
        announcement.cohortIds.length === 0 ||
        announcement.cohortIds.includes(classId)
    )
    // One bounded display date per relevant announcement: its start date, or
    // today when it has already started. A long validity range stays one section.
    .map((announcement) => {
      const start = new Date(announcement.validFrom);
      return toDateKey(start <= now ? today : start);
    });

const hasVisibleContent = (
  subs: Subs[],
  movedLessons: MovedLessonItem[],
  today: Date,
  announcementCount: number
): boolean =>
  subs.some((sub) => parseDateOnly(sub.substitution.date) >= today) ||
  movedLessons.some((ml) => parseDateOnly(ml.movedLesson.date) >= today) ||
  announcementCount > 0;

const getCohortsForDate = (
  subs: Subs[],
  movedLessons: MovedLessonItem[]
): string[] =>
  [
    ...new Set([
      ...subs.flatMap((sub) =>
        sub.lessons.flatMap((lesson) => lesson?.cohorts ?? [])
      ),
      ...movedLessons.flatMap((ml) =>
        ml.lessons.flatMap((lesson) => lesson.cohorts)
      ),
    ]),
  ].sort(compareClassNames);

const buildDateCohortBoxes = (
  date: string,
  dateSubs: Subs[],
  dateMovedLessons: MovedLessonItem[]
): ReactNode[] => {
  const cohorts = getCohortsForDate(dateSubs, dateMovedLessons);

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
      date={date}
      key={`${date}-${cohort}`}
      movedLessons={dateMovedLessons
        .map((ml) => ({
          ...ml,
          lessons: ml.lessons.filter((l) => l.cohorts.includes(cohort)),
        }))
        .filter((ml) => ml.lessons.length > 0)}
    />
  ));

  const unassignedMovedLessons = dateMovedLessons.filter(
    (ml) => !ml.lessons.some((l) => l.cohorts.length > 0)
  );

  const movedCard =
    unassignedMovedLessons.length > 0 ? (
      <SubsV
        data={[]}
        date={date}
        key={`${date}-moved`}
        movedLessons={unassignedMovedLessons}
      />
    ) : null;

  return [...cohortCards, movedCard].filter(Boolean);
};

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

  const selectedValue = getActiveSelectionId(activeFilter, selections) ?? '';
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
  const { data: session, isPending } = authClient.useSession();
  const { i18n, t } = useTranslation();

  const [activeFilter, setActiveFilter] = useState<FilterType>('class');
  const [selections, setSelections] = useState<SelectionsType>({
    class: null,
    classroom: null,
    teacher: null,
  });

  const isAuthenticated = !isPending && !!session;
  const myTeacherQuery = useMyTeacher(isAuthenticated, session?.user?.id);
  const myTeacher = myTeacherQuery.data;

  // Default the view to the user's linked teacher, else their profile class.
  const defaultInitialized = useRef(false);
  useEffect(() => {
    if (defaultInitialized.current || isPending) {
      return;
    }
    // Wait until the teacher profile resolves before defaulting.
    if (isAuthenticated && myTeacherQuery.isPending) {
      return;
    }
    defaultInitialized.current = true;
    if (myTeacher) {
      setActiveFilter('teacher');
      setSelections((s) => ({ ...s, teacher: myTeacher.id }));
      return;
    }
    const cohortId = session?.user?.cohortId ?? null;
    if (cohortId) {
      setSelections((s) => (s.class === null ? { ...s, class: cohortId } : s));
    }
  }, [
    isPending,
    isAuthenticated,
    myTeacher,
    myTeacherQuery.isPending,
    session?.user?.cohortId,
  ]);

  const timetablesQuery = useTimetables();

  const latestValidTimetableQuery = useLatestValidTimetable();

  const latestTimetableId =
    latestValidTimetableQuery.data?.id ?? timetablesQuery.data?.[0]?.id ?? null;

  const cohortsQuery = useTimetableCohorts(latestTimetableId);

  const teachersQuery = useTeachers();

  const classroomsQuery = useClassrooms();

  const substitutionsQuery = usePublicSubstitutions(!isPending);

  const movedLessonsQuery = usePublicMovedLessons(!isPending);

  const announcementsQuery = useAnnouncementsPanel(!isPending);

  const activeSelectionId = getActiveSelectionId(activeFilter, selections);

  const newsClassId = activeFilter === 'class' ? selections.class : null;

  const activeCohortName = getActiveCohortName(
    activeFilter,
    activeSelectionId,
    cohortsQuery.data
  );

  const filteredSubs = filterSubs(
    substitutionsQuery.data ?? [],
    activeFilter,
    activeSelectionId,
    cohortsQuery.data
  );

  const filteredMovedLessons = filterMovedLessons(
    movedLessonsQuery.data ?? [],
    activeFilter,
    activeSelectionId,
    cohortsQuery.data
  );

  const isLoading =
    substitutionsQuery.isLoading ||
    substitutionsQuery.isFetching ||
    movedLessonsQuery.isLoading ||
    movedLessonsQuery.isFetching;
  const hasError = substitutionsQuery.error || movedLessonsQuery.error;

  const groupedData = groupByDate(filteredSubs);
  const groupedMovedLessons = groupMovedLessonsByDate(filteredMovedLessons);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const now = new Date();

  const announcementDates = getAnnouncementDates(
    announcementsQuery.data ?? [],
    newsClassId,
    today,
    now
  );

  const allDates = Array.from(
    new Set([
      ...Object.keys(groupedData),
      ...Object.keys(groupedMovedLessons),
      ...announcementDates,
    ])
  )
    .filter((date) => parseDateOnly(date) >= today)
    .sort((a, b) => a.localeCompare(b));

  const hasContent = hasVisibleContent(
    filteredSubs,
    filteredMovedLessons,
    today,
    announcementDates.length
  );

  const selectorLoading = getSelectorLoading(
    activeFilter,
    cohortsQuery.isLoading,
    teachersQuery.isLoading,
    classroomsQuery.isLoading
  );

  const renderDateSection = (date: string) => {
    const dateSubs = groupedData[date] ?? [];
    const dateMovedLessons = groupedMovedLessons[date] ?? [];
    const dayAnnouncements = getAnnouncementsForDay(
      announcementsQuery.data,
      date,
      newsClassId
    );

    let boxes: ReactNode[] = [];

    if (activeCohortName) {
      if (dateSubs.length > 0 || dateMovedLessons.length > 0) {
        boxes = [
          <SubsV
            cohortFilter={activeCohortName}
            data={dateSubs}
            date={date}
            key={`${date}-${activeCohortName}`}
            movedLessons={dateMovedLessons}
          />,
        ];
      }
    } else {
      boxes = buildDateCohortBoxes(date, dateSubs, dateMovedLessons);
    }

    // Under a class filter exactly one card is rendered for the active class;
    // otherwise count the distinct cohorts that have lessons that day.
    const cohortCount = activeCohortName
      ? boxes.length
      : getCohortsForDate(dateSubs, dateMovedLessons).length;
    const isToday =
      parseDateOnly(date).toDateString() === new Date().toDateString();

    return (
      <section className="space-y-3" key={date}>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              isToday
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground text-lg">
              {formatLocalizedDate(parseDateOnly(date), i18n.language, {
                day: '2-digit',
                month: 'long',
                weekday: 'long',
                year: 'numeric',
              })}
            </h2>
            {cohortCount > 0 && (
              <p className="text-muted-foreground text-sm">
                {t('substitution.classCount', { count: cohortCount })}
              </p>
            )}
          </div>
        </div>
        {dayAnnouncements.length > 0 && <DayNews items={dayAnnouncements} />}
        <div className="grid gap-3">{boxes}</div>
      </section>
    );
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
        {!(isLoading || hasError) && hasContent
          ? allDates.map((date) => renderDateSection(date))
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
