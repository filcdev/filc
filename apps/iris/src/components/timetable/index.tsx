import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useEffect, useMemo, useState } from 'react';
import type z from 'zod';
import { FilterBar } from '@/components/timetable/filter-bar';
import { TimetableGrid } from '@/components/timetable/grid';
import { buildViewModel } from '@/components/timetable/helpers';
import type {
  ClassroomItem,
  CohortItem,
  FilterType,
  LessonItem,
  SelectionsType,
  TeacherItem,
} from '@/components/timetable/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Route, type searchSchema } from '@/routes/_public/index';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';

// Constants
const QUERY_OPTIONS = {
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: Number.POSITIVE_INFINITY,
};

// API Calls
const fetchCohorts = async () => {
  const res = await parseResponse(api.cohort.index.$get());
  if (!res.success) {
    throw new Error('Failed to load cohorts');
  }
  return (res.data ?? []) as CohortItem[];
};

const fetchTeachers = async () => {
  const res = await parseResponse(api.timetable.teachers.getAll.$get());
  if (!res.success) {
    throw new Error('Failed to load teachers');
  }
  return (res.data ?? []) as TeacherItem[];
};

const fetchClassrooms = async () => {
  const res = await parseResponse(api.timetable.classrooms.getAll.$get());
  if (!res.success) {
    throw new Error('Failed to load classrooms');
  }
  return (res.data ?? []) as ClassroomItem[];
};

const fetchLessonsForSelection = async (
  filter: FilterType,
  selectionId: string
): Promise<LessonItem[]> => {
  const endpoints = {
    class: () =>
      api.timetable.lessons.getForCohort[':cohortId'].$get({
        param: { cohortId: selectionId },
      }),
    classroom: () =>
      api.timetable.lessons.getForRoom[':classroomId'].$get({
        param: { classroomId: selectionId },
      }),
    teacher: () =>
      api.timetable.lessons.getForTeacher[':teacherId'].$get({
        param: { teacherId: selectionId },
      }),
  };

  const res = await parseResponse(endpoints[filter]());
  if (!res.success) {
    throw new Error('Failed to load lessons');
  }
  return (res.data ?? []) as LessonItem[];
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
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate({ from: Route.fullPath });

  // Queries
  const cohortsQuery = useQuery({
    ...QUERY_OPTIONS,
    queryFn: fetchCohorts,
    queryKey: ['cohorts'],
  });

  const teachersQuery = useQuery({
    ...QUERY_OPTIONS,
    queryFn: fetchTeachers,
    queryKey: ['teachers'],
  });

  const classroomsQuery = useQuery({
    ...QUERY_OPTIONS,
    queryFn: fetchClassrooms,
    queryKey: ['classrooms'],
  });

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

  const activeSelectionId = getActiveSelectionId(activeFilter, selections);

  // Fetch lessons
  const lessonsQuery = useQuery({
    ...QUERY_OPTIONS,
    enabled: !!activeSelectionId,
    queryFn: () =>
      activeSelectionId
        ? fetchLessonsForSelection(activeFilter, activeSelectionId)
        : Promise.resolve([] as LessonItem[]),
    queryKey: ['lessons', activeFilter, activeSelectionId],
  });

  // Initialize from URL or defaults
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: TODO
  useEffect(() => {
    const allDataLoaded =
      cohortsQuery.data && teachersQuery.data && classroomsQuery.data;
    const anySelectionMade =
      selections.class || selections.teacher || selections.classroom;

    if (!allDataLoaded || anySelectionMade || isPending) {
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
      const userDefault = session?.user?.cohortId as string | undefined;
      const firstCohort = cohortsQuery.data[0]?.id ?? null;
      setSelections((s) => ({ ...s, class: userDefault ?? firstCohort }));
    }
  }, [
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
    session,
    isPending,
    selections.class,
    selections.classroom,
    selections.teacher,
    search.cohort,
    search.teacher,
    search.room,
  ]);

  // Set default selection when filter changes
  useEffect(() => {
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
    activeFilter,
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
    selections.class,
    selections.classroom,
    selections.teacher,
  ]);

  // Sync selection to URL
  useEffect(() => {
    if (activeSelectionId) {
      const searchParams: z.Infer<typeof searchSchema> = {
        cohort: undefined,
        room: undefined,
        teacher: undefined,
      };

      const paramKey = `${activeFilter}` as 'cohort' | 'teacher' | 'room';
      searchParams[paramKey] = activeSelectionId;
      navigate({
        replace: true,
        search: () => searchParams,
      });
    }
  }, [activeFilter, activeSelectionId, navigate]);

  const model = useMemo(
    () => buildViewModel((lessonsQuery.data ?? []) as LessonItem[]),
    [lessonsQuery.data]
  );

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
    <div className="flex grow flex-col items-center gap-4 p-4">
      <FilterBar
        activeFilter={activeFilter}
        classrooms={classroomsQuery.data}
        cohorts={cohortsQuery.data}
        disabled={isLoading}
        onFilterChange={setActiveFilter}
        onPrint={() => window.print()}
        onSelectClass={(id) => setSelections((s) => ({ ...s, class: id }))}
        onSelectRoom={(id) => setSelections((s) => ({ ...s, classroom: id }))}
        onSelectTeacher={(id) => setSelections((s) => ({ ...s, teacher: id }))}
        selectedByClass={selections.class}
        selectedByRoom={selections.classroom}
        selectedByTeacher={selections.teacher}
        selectorLoading={selectorLoading}
        teachers={teachersQuery.data}
      />

      {hasError && (
        <div className="text-red-500">Failed to load timetable.</div>
      )}

      {isLoading ? (
        <div className="w-full max-w-7xl">
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-130 w-full" />
        </div>
      ) : (
        <div
          className="w-full max-w-7xl print:max-w-none"
          id="timetable-print-root"
        >
          <TimetableGrid model={model} />
        </div>
      )}
    </div>
  );
}
