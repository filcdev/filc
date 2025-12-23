import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useEffect, useMemo, useState } from 'react';
import { FilterBar } from '@/components/timetable/filter-bar';
import { TimetableGrid } from '@/components/timetable/grid';
import {
  buildViewModel,
  formatTeachers,
  getSelectedFromUrl,
} from '@/components/timetable/helpers';
import type {
  ClassroomItem,
  CohortItem,
  FilterType,
  LessonItem,
  TeacherItem,
} from '@/components/timetable/types';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';

const fetchLessonsForSelection = async (
  filter: FilterType,
  selectionId: string
): Promise<LessonItem[]> => {
  if (filter === 'class') {
    const res = await parseResponse(
      api.timetable.lessons.getForCohort[':cohortId'].$get({
        param: { cohortId: selectionId },
      })
    );
    if (!res.success) {
      throw new Error('Failed to load lessons');
    }
    return (res.data ?? []) as LessonItem[];
  }

  if (filter === 'teacher') {
    const res = await parseResponse(
      api.timetable.lessons.getForTeacher[':teacherId'].$get({
        param: { teacherId: selectionId },
      })
    );
    if (!res.success) {
      throw new Error('Failed to load lessons');
    }
    return (res.data ?? []) as LessonItem[];
  }

  const res = await parseResponse(
    api.timetable.lessons.getForRoom[':classroomId'].$get({
      param: { classroomId: selectionId },
    })
  );
  if (!res.success) {
    throw new Error('Failed to load lessons');
  }
  return (res.data ?? []) as LessonItem[];
};

export function TimetableView() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  const cohortsQuery = useQuery({
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return (res.data ?? []) as CohortItem[];
    },
    queryKey: ['cohorts'],
    staleTime: Number.POSITIVE_INFINITY,
  });

  const teachersQuery = useQuery({
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const res = await parseResponse(api.timetable.teachers.getAll.$get());
      if (!res.success) {
        throw new Error('Failed to load teachers');
      }
      return (res.data ?? []) as TeacherItem[];
    },
    queryKey: ['teachers'],
    staleTime: Number.POSITIVE_INFINITY,
  });

  const classroomsQuery = useQuery({
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const res = await parseResponse(api.timetable.classrooms.getAll.$get());
      if (!res.success) {
        throw new Error('Failed to load classrooms');
      }
      return (res.data ?? []) as ClassroomItem[];
    },
    queryKey: ['classrooms'],
    staleTime: Number.POSITIVE_INFINITY,
  });

  const [activeFilter, setActiveFilter] = useState<FilterType>('class');
  const [selectedByClass, setSelectedByClass] = useState<string | null>(null);
  const [selectedByTeacher, setSelectedByTeacher] = useState<string | null>(
    null
  );
  const [selectedByRoom, setSelectedByRoom] = useState<string | null>(null);

  const activeSelectionId = useMemo(() => {
    if (activeFilter === 'class') {
      return selectedByClass;
    }
    if (activeFilter === 'teacher') {
      return selectedByTeacher;
    }
    return selectedByRoom;
  }, [activeFilter, selectedByClass, selectedByTeacher, selectedByRoom]);

  useEffect(() => {
    if (
      !(cohortsQuery.data && teachersQuery.data && classroomsQuery.data) ||
      selectedByClass ||
      selectedByTeacher ||
      selectedByRoom ||
      isPending
    ) {
      return;
    }

    const { cohortClass, cohortTeacher, cohortClassroom } = getSelectedFromUrl(
      cohortsQuery.data,
      teachersQuery.data,
      classroomsQuery.data
    );

    if (cohortClass) {
      setActiveFilter('class');
      setSelectedByClass(cohortClass);
      return;
    }
    if (cohortTeacher) {
      setActiveFilter('teacher');
      setSelectedByTeacher(cohortTeacher);
      return;
    }
    if (cohortClassroom) {
      setActiveFilter('classroom');
      setSelectedByRoom(cohortClassroom);
      return;
    }

    const userDefault = session?.user?.cohortId as string | undefined;
    const first = cohortsQuery.data[0]?.id ?? null;
    setActiveFilter('class');
    setSelectedByClass(userDefault ?? first);
  }, [
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
    selectedByClass,
    selectedByTeacher,
    selectedByRoom,
    session,
    isPending,
  ]);

  useEffect(() => {
    if (
      activeFilter === 'class' &&
      !selectedByClass &&
      cohortsQuery.data?.[0]
    ) {
      setSelectedByClass(cohortsQuery.data[0].id);
      return;
    }
    if (
      activeFilter === 'teacher' &&
      !selectedByTeacher &&
      teachersQuery.data?.[0]
    ) {
      setSelectedByTeacher(teachersQuery.data[0].id);
      return;
    }
    if (
      activeFilter === 'classroom' &&
      !selectedByRoom &&
      classroomsQuery.data?.[0]
    ) {
      setSelectedByRoom(classroomsQuery.data[0].id);
    }
  }, [
    activeFilter,
    selectedByClass,
    selectedByTeacher,
    selectedByRoom,
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
  ]);

  useEffect(() => {
    if (!activeSelectionId) {
      return;
    }

    try {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      const before = params.toString();

      params.delete('cohortClass');
      params.delete('cohortTeacher');
      params.delete('cohortClassroom');

      if (activeFilter === 'class') {
        params.set('cohortClass', activeSelectionId);
      } else if (activeFilter === 'teacher') {
        params.set('cohortTeacher', activeSelectionId);
      } else {
        params.set('cohortClassroom', activeSelectionId);
      }

      const next = params.toString();
      if (next === before) {
        return;
      }

      navigate({ replace: true, to: `${url.pathname}?${next}` });
    } catch {
      // ignore URL/navigation errors
    }
  }, [activeFilter, activeSelectionId, navigate]);

  const lessonsQuery = useQuery({
    enabled: !!activeSelectionId,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      if (!activeSelectionId) {
        return [] as LessonItem[];
      }
      return await fetchLessonsForSelection(activeFilter, activeSelectionId);
    },
    queryKey: ['lessons', activeFilter, activeSelectionId],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const selectedName = useMemo(() => {
    if (activeFilter === 'class' && selectedByClass) {
      return (
        cohortsQuery.data?.find((c) => c.id === selectedByClass)?.name ??
        'Class'
      );
    }
    if (activeFilter === 'teacher' && selectedByTeacher) {
      const teacher = teachersQuery.data?.find(
        (t) => t.id === selectedByTeacher
      ) as LessonItem['teachers'][number] | undefined;
      return teacher ? formatTeachers([teacher]) : 'Teacher';
    }
    if (activeFilter === 'classroom' && selectedByRoom) {
      return (
        classroomsQuery.data?.find((c) => c.id === selectedByRoom)?.name ??
        'Classroom'
      );
    }
    return 'Schedule';
  }, [
    activeFilter,
    selectedByClass,
    selectedByTeacher,
    selectedByRoom,
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
  ]);

  const model = useMemo(
    () => buildViewModel((lessonsQuery.data ?? []) as LessonItem[]),
    [lessonsQuery.data]
  );

  const selectorLoading = (() => {
    if (activeFilter === 'class') {
      return cohortsQuery.isLoading;
    }
    if (activeFilter === 'teacher') {
      return teachersQuery.isLoading;
    }
    return classroomsQuery.isLoading;
  })();

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
        onSelectClass={setSelectedByClass}
        onSelectRoom={setSelectedByRoom}
        onSelectTeacher={setSelectedByTeacher}
        selectedByClass={selectedByClass}
        selectedByRoom={selectedByRoom}
        selectedByTeacher={selectedByTeacher}
        selectorLoading={selectorLoading}
        teachers={teachersQuery.data}
      />

      {hasError && (
        <div className="text-red-500">Failed to load timetable.</div>
      )}

      {isLoading ? (
        <div className="w-full max-w-7xl">
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-[520px] w-full" />
        </div>
      ) : (
        <div
          className="w-full max-w-7xl print:max-w-none"
          id="timetable-print-root"
        >
          <TimetableGrid
            model={model}
            title={`${selectedName} - Week Schedule`}
          />
        </div>
      )}
    </div>
  );
}
