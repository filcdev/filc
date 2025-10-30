import { useQuery } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { useEffect, useMemo, useState } from 'react';
import {
  type ClassSession,
  type DayMetadata,
  Timetable,
  type TimetableData,
} from '~/frontend/components/timetable';
import { Button } from '~/frontend/components/ui/button';
import { Skeleton } from '~/frontend/components/ui/skeleton';
import { authClient } from '~/frontend/utils/authentication';
import { apiClient } from '~/frontend/utils/hc';

// Local types for API responses
type Cohort = { id: string; name: string; short: string };
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

  return {
    color: colorFromSubject(subject),
    endTime: end,
    id: lesson.id,
    room,
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

export function TimetableView() {
  const { data: session, isPending } = authClient.useSession();

  const cohortsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(apiClient.cohort.index.$get());
      if (!res.success) {
        throw new Error('Failed to load cohorts');
      }
      return res.data as Cohort[];
    },
    queryKey: ['cohorts'],
  });

  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);

  useEffect(() => {
    if (!cohortsQuery.data || selectedCohortId || isPending) {
      return;
    }
    const userDefault = session?.user?.cohortId as string | undefined;
    const first = cohortsQuery.data[0]?.id;
    setSelectedCohortId(userDefault ?? first ?? null);
  }, [cohortsQuery.data, selectedCohortId, session, isPending]);

  const lessonsQuery = useQuery({
    enabled: !!selectedCohortId,
    queryFn: async (): Promise<EnrichedLesson[]> => {
      if (!selectedCohortId) {
        return [];
      }
      const res = await parseResponse(
        apiClient.timetable.lessons.get_for_cohort[':cohort_id'].$get({
          param: { cohort_id: selectedCohortId },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load lessons');
      }
      return (res.data as EnrichedLesson[]) ?? [];
    },
    queryKey: ['lessons', selectedCohortId],
  });

  const selectedCohort = useMemo(
    () => cohortsQuery.data?.find((c) => c.id === selectedCohortId) ?? null,
    [cohortsQuery.data, selectedCohortId]
  );

  const { timetableData, dayMetadata } = useMemo(
    () => buildTimetableData(lessonsQuery.data ?? []),
    [lessonsQuery.data]
  );

  const isLoading =
    cohortsQuery.isLoading || lessonsQuery.isLoading || !selectedCohortId;
  const hasError = cohortsQuery.error || lessonsQuery.error;

  return (
    <div className="flex grow flex-col items-center gap-4 p-4">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm" htmlFor="cohort">
            Cohort
          </label>
          {cohortsQuery.isLoading ? (
            <Skeleton className="h-9 w-56" />
          ) : (
            <select
              className="h-9 w-56 rounded-md border px-2 text-sm"
              id="cohort"
              onChange={(e) => setSelectedCohortId(e.target.value)}
              value={selectedCohortId ?? ''}
            >
              {(cohortsQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
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
        <div className="w-full max-w-5xl">
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-[480px] w-full" />
        </div>
      ) : (
        <div className="w-full max-w-5xl">
          <Timetable
            className="shadow-2xl"
            data={timetableData}
            dayMetadata={dayMetadata}
            title={`${selectedCohort?.name ?? 'Cohort'} - Week Schedule`}
          />
        </div>
      )}
    </div>
  );
}
