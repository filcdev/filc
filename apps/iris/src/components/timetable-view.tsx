import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { parseResponse } from 'hono/client';
import { useEffect, useMemo, useState } from 'react';
import {
  type ClassSession,
  type DayMetadata,
  Timetable,
  type TimetableData,
} from '@/components/timetable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';

// Local types for API responses
type Cohort = { id: string; name: string; short: string };
type Teacher = { id: string; firstName: string; lastName: string };
type EnrichedLesson = {
  id: string;
  subject: { id: string; name: string; short: string } | null;
  teachers: Array<{ id: string; name: string; short: string }>;
  classrooms: Array<{ id: string; name: string; short: string }>;
  day: {
    id: string;
    name: string;
    short: string;
    days?: string[];
  } | null;
  period: {
    id: string;
    startTime: string;
    endTime: string;
    period: number;
  } | null;
  weeksDefinitionId: string;
  termDefinitionId: string | null;
  periodsPerWeek: number;
};

// Helpers
const TIME_FORMAT_SLICE = 5;
const toHHMM = (t: string) => t.slice(0, TIME_FORMAT_SLICE);

const COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#3b82f6',
] as const;

const colorFromSubject = (name: string) => {
  let sum = 0;
  for (const ch of name) {
    sum += ch.codePointAt(0) ?? 0;
  }
  const idx = Math.abs(sum) % COLORS.length;
  return COLORS[idx] ?? COLORS[0];
};

// Extract helper to upsert class session into timetable data
const upsertClassSession = (
  data: TimetableData,
  day: string,
  time: string,
  item: ClassSession
) => {
  data[day] ??= {};
  const cell = data[day][time];
  if (!cell) {
    data[day][time] = [item];
    return;
  }
  if (Array.isArray(cell)) {
    cell.push(item);
    return;
  }
  data[day][time] = [cell, item];
};

// Extract helper to create class session from lesson
const createClassSession = (lesson: EnrichedLesson): ClassSession => {
  const start = lesson.period ? toHHMM(lesson.period.startTime) : '00:00';
  const end = lesson.period ? toHHMM(lesson.period.endTime) : '00:00';
  const subject = lesson.subject?.name ?? '—';
  const teacher = lesson.teachers.map((t) => t.name).join(', ');
  const room = lesson.classrooms.map((r) => r.short || r.name).join(', ');
  const short = lesson.subject?.short ?? subject;

  return {
    color: colorFromSubject(subject),
    endTime: end,
    id: lesson.id,
    room,
    short,
    startTime: start,
    subject,
    teacher,
  };
};

// Extract helper to update day metadata
const updateDayMetadata = (
  metadata: DayMetadata,
  day: string,
  lesson: EnrichedLesson
) => {
  if (lesson.day && !metadata[day]) {
    const dayNumber = lesson.day.days?.[0]
      ? Number.parseInt(lesson.day.days[0], 10)
      : 999;
    metadata[day] = { sortOrder: dayNumber };
  }
};

// Main function to build timetable data from lessons
const buildTimetableData = (lessons: EnrichedLesson[]) => {
  const data: TimetableData = {};
  const metadata: DayMetadata = {};

  for (const lesson of lessons) {
    const day = lesson.day?.name ?? 'Unknown';
    const classSession = createClassSession(lesson);

    upsertClassSession(data, day, classSession.startTime, classSession);
    updateDayMetadata(metadata, day, lesson);
  }

  return { dayMetadata: metadata, timetableData: data };
};

// Helper to initialize selected cohort from URL parameters
const getSelectedCohortFromUrl = (
  cohortsData: Cohort[] | undefined,
  teachersData: Teacher[] | undefined,
  classroomsData: Cohort[] | undefined
): {
  cohortClass: string | null;
  cohortTeacher: string | null;
  cohortClassroom: string | null;
} => {
  try {
    const params = new URLSearchParams(window.location.search);

    const urlCohort = params.get('cohortClass');
    if (urlCohort && cohortsData?.some((c) => c.id === urlCohort)) {
      return {
        cohortClass: urlCohort,
        cohortClassroom: null,
        cohortTeacher: null,
      };
    }

    const urlCohortByTeacher = params.get('cohortTeacher');
    if (
      urlCohortByTeacher &&
      teachersData?.some((t) => t.id === urlCohortByTeacher)
    ) {
      return {
        cohortClass: null,
        cohortClassroom: null,
        cohortTeacher: urlCohortByTeacher,
      };
    }

    const urlCohortByClassroom = params.get('cohortClassroom');
    if (
      urlCohortByClassroom &&
      classroomsData?.some((c) => c.id === urlCohortByClassroom)
    ) {
      return {
        cohortClass: null,
        cohortClassroom: urlCohortByClassroom,
        cohortTeacher: null,
      };
    }
  } catch {
    // ignore URL parse errors
  }

  return { cohortClass: null, cohortClassroom: null, cohortTeacher: null };
};

// Helper to fetch lessons for a cohort
const fetchLessonsForCohort = async (
  cohortId: string
): Promise<EnrichedLesson[]> => {
  const res = await parseResponse(
    api.timetable.lessons['get-for-cohort'][':cohort_id'].$get({
      param: {
        cohort_id: cohortId,
      },
    })
  );
  if (!res.success) {
    throw new Error('Failed to load lessons');
  }
  return (res.data as EnrichedLesson[]) ?? [];
};

// Helper to fetch lessons for a teacher
const fetchLessonsForTeacher = async (
  teacherId: string
): Promise<EnrichedLesson[]> => {
  const res = await parseResponse(
    api.timetable.lessons['get-for-teacher'][':teacher_id'].$get({
      param: {
        teacher_id: teacherId,
      },
    })
  );
  if (!res.success) {
    throw new Error('Failed to load lessons');
  }
  return (res.data as EnrichedLesson[]) ?? [];
};

// Helper to fetch lessons for a classroom
const fetchLessonsForClassroom = async (
  classroomId: string
): Promise<EnrichedLesson[]> => {
  const res = await parseResponse(
    api.timetable.lessons['get-for-room'][':classroom_id'].$get({
      param: {
        classroom_id: classroomId,
      },
    })
  );
  if (!res.success) {
    throw new Error('Failed to load lessons');
  }
  return (res.data as EnrichedLesson[]) ?? [];
};

export function TimetableView() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  const cohortsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return res.data as Cohort[];
    },
    queryKey: ['cohorts'],
  });

  const teachersQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.timetable.teachers['get-all'].$get());
      if (!res.success) {
        throw new Error('Failed to load teachers');
      }
      return res.data as Teacher[];
    },
    queryKey: ['teachers'],
  });

  const classroomsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(
        api.timetable.classrooms['get-all'].$get()
      );
      if (!res.success) {
        throw new Error('Failed to load classrooms');
      }
      return res.data as Cohort[];
    },
    queryKey: ['classrooms'],
  });

  const [selectedCohortIdByClass, setSelectedCohortIdByClass] = useState<
    string | null
  >(null);
  const [selectedCohortIdByTeacher, setSelectedCohortIdByTeacher] = useState<
    string | null
  >(null);
  const [selectedCohortIdByClassroom, setSelectedCohortIdByClassroom] =
    useState<string | null>(null);

  // Initialize selected cohort from URL (if present) or user default / first cohort.
  useEffect(() => {
    if (
      !(cohortsQuery.data && teachersQuery.data && classroomsQuery.data) ||
      selectedCohortIdByClass ||
      selectedCohortIdByTeacher ||
      selectedCohortIdByClassroom ||
      isPending
    ) {
      return;
    }

    const { cohortClass, cohortTeacher, cohortClassroom } =
      getSelectedCohortFromUrl(
        cohortsQuery.data,
        teachersQuery.data,
        classroomsQuery.data
      );

    if (cohortClass) {
      setSelectedCohortIdByClass(cohortClass);
      return;
    }
    if (cohortTeacher) {
      setSelectedCohortIdByTeacher(cohortTeacher);
      return;
    }
    if (cohortClassroom) {
      setSelectedCohortIdByClassroom(cohortClassroom);
      return;
    }

    const userDefault = session?.user?.cohortId as string | undefined;
    const first = cohortsQuery.data[0]?.id;
    setSelectedCohortIdByClass(userDefault ?? first ?? null);
  }, [
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
    selectedCohortIdByClass,
    selectedCohortIdByTeacher,
    selectedCohortIdByClassroom,
    session,
    isPending,
  ]);

  // Keep URL in sync with selected cohort
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Multiple conditions needed for URL synchronization
  useEffect(() => {
    if (
      !(
        selectedCohortIdByClass ||
        selectedCohortIdByTeacher ||
        selectedCohortIdByClassroom
      )
    ) {
      return;
    }

    try {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(url.search);
      if (
        params.get('cohortClass') !== selectedCohortIdByClass &&
        selectedCohortIdByClass != null
      ) {
        params.delete('cohortTeacher');
        params.delete('cohortClassroom');
        params.set('cohortClass', selectedCohortIdByClass ?? '');
      } else if (
        params.get('cohortTeacher') !== selectedCohortIdByTeacher &&
        selectedCohortIdByTeacher != null
      ) {
        params.delete('cohortClass');
        params.delete('cohortClassroom');
        params.set('cohortTeacher', selectedCohortIdByTeacher ?? '');
      } else if (
        params.get('cohortClassroom') !== selectedCohortIdByClassroom &&
        selectedCohortIdByClassroom != null
      ) {
        params.delete('cohortClass');
        params.delete('cohortTeacher');
        params.set('cohortClassroom', selectedCohortIdByClassroom ?? '');
      }
      const to = `${url.pathname}?${params.toString()}`;
      navigate({ replace: true, to });
    } catch {
      // ignore URL/navigation errors
    }
  }, [
    selectedCohortIdByClass,
    selectedCohortIdByTeacher,
    selectedCohortIdByClassroom,
    navigate,
  ]);

  const lessonsQuery = useQuery({
    enabled: !!(
      selectedCohortIdByClass ||
      selectedCohortIdByTeacher ||
      selectedCohortIdByClassroom
    ),
    queryFn: async (): Promise<EnrichedLesson[]> => {
      if (selectedCohortIdByClass) {
        return await fetchLessonsForCohort(selectedCohortIdByClass);
      }
      if (selectedCohortIdByTeacher) {
        return await fetchLessonsForTeacher(selectedCohortIdByTeacher);
      }
      if (selectedCohortIdByClassroom) {
        return await fetchLessonsForClassroom(selectedCohortIdByClassroom);
      }
      return [];
    },
    queryKey: [
      'lessons',
      selectedCohortIdByClass,
      selectedCohortIdByTeacher,
      selectedCohortIdByClassroom,
    ],
  });

  const selectedName = useMemo(() => {
    if (selectedCohortIdByClass) {
      return (
        cohortsQuery.data?.find((c) => c.id === selectedCohortIdByClass)
          ?.name ?? 'Class'
      );
    }
    if (selectedCohortIdByTeacher) {
      const teacher = teachersQuery.data?.find(
        (t) => t.id === selectedCohortIdByTeacher
      );
      return teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Teacher';
    }
    if (selectedCohortIdByClassroom) {
      return (
        classroomsQuery.data?.find((c) => c.id === selectedCohortIdByClassroom)
          ?.name ?? 'Classroom'
      );
    }
    return 'Schedule';
  }, [
    selectedCohortIdByClass,
    selectedCohortIdByTeacher,
    selectedCohortIdByClassroom,
    cohortsQuery.data,
    teachersQuery.data,
    classroomsQuery.data,
  ]);

  const { timetableData, dayMetadata } = useMemo(
    () => buildTimetableData(lessonsQuery.data ?? []),
    [lessonsQuery.data]
  );

  const isLoading =
    cohortsQuery.isLoading ||
    teachersQuery.isLoading ||
    classroomsQuery.isLoading ||
    lessonsQuery.isLoading ||
    !(
      selectedCohortIdByClass ||
      selectedCohortIdByTeacher ||
      selectedCohortIdByClassroom
    );
  const hasError =
    cohortsQuery.error ||
    teachersQuery.error ||
    classroomsQuery.error ||
    lessonsQuery.error;

  return (
    <div className="flex grow flex-col items-center gap-4 p-4">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="cohort">
            Class
          </label>
          {cohortsQuery.isLoading ? (
            <Skeleton className="h-9 w-24" />
          ) : (
            <select
              className="h-9 w-24 rounded-md border px-2 text-sm"
              id="cohort"
              onChange={(e) => {
                setSelectedCohortIdByClass(e.target.value);
                setSelectedCohortIdByTeacher(null);
                setSelectedCohortIdByClassroom(null);
              }} //different selected, query variable for each
              value={selectedCohortIdByClass ?? ''}
            >
              {(cohortsQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="teacher">
            Teacher
          </label>
          {teachersQuery.isLoading ? (
            <Skeleton className="h-9 w-48" />
          ) : (
            <select
              className="h-9 w-48 rounded-md border px-2 text-sm"
              id="teacher"
              onChange={(e) => {
                setSelectedCohortIdByTeacher(e.target.value);
                setSelectedCohortIdByClass(null);
                setSelectedCohortIdByClassroom(null);
              }}
              value={selectedCohortIdByTeacher ?? ''}
            >
              {(teachersQuery.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="classroom">
            Classroom
          </label>
          {classroomsQuery.isLoading ? (
            <Skeleton className="h-9 w-48" />
          ) : (
            <select
              className="h-9 w-48 rounded-md border px-2 text-sm"
              id="classroom"
              onChange={(e) => {
                setSelectedCohortIdByClassroom(e.target.value);
                setSelectedCohortIdByClass(null);
                setSelectedCohortIdByTeacher(null);
              }}
              value={selectedCohortIdByClassroom ?? ''}
            >
              {(classroomsQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()} size="sm" variant="outline">
            Save to PDF
          </Button>
          <Button
            onClick={() => lessonsQuery.refetch()}
            size="sm"
            variant="outline"
          >
            Refresh
          </Button>
        </div>
      </div>

      {hasError && (
        <div className="text-red-500">Failed to load timetable.</div>
      )}

      {isLoading ? (
        <div className="w-full max-w-7xl">
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-[480px] w-full" />
        </div>
      ) : (
        <div id="timetable-print-root">
          <div className="w-full max-w-7xl">
            <Timetable
              className="shadow-2xl"
              data={timetableData}
              dayMetadata={dayMetadata}
              title={`${selectedName} - Week Schedule`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
