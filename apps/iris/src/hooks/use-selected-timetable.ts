import { useQuery } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { useMemo, useState } from 'react';
import { api } from '@/utils/hc';

type TimetableItem = {
  id: string;
  name: string;
  validFrom: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const QUERY_OPTIONS = {
  gcTime: Number.POSITIVE_INFINITY,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: Number.POSITIVE_INFINITY,
};

const fetchTimetables = async (): Promise<TimetableItem[]> => {
  const res = await parseResponse(api.timetable.timetables.$get());
  if (!res.success) {
    throw new Error('Failed to load timetables');
  }
  return (res.data ?? []) as TimetableItem[];
};

const dateToYYYYMMDD = (date: Date): string =>
  date.toLocaleDateString('en-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export function useSelectedTimetable(initialTimetableId?: string) {
  const timetablesQuery = useQuery({
    ...QUERY_OPTIONS,
    queryFn: fetchTimetables,
    queryKey: ['timetables'],
  });

  const sortedTimetables = useMemo(() => {
    if (!timetablesQuery.data) {
      return [];
    }
    return [...timetablesQuery.data].sort((a, b) => {
      if (!(a.validFrom || b.validFrom)) {
        return 0;
      }
      if (!a.validFrom) {
        return 1;
      }
      if (!b.validFrom) {
        return -1;
      }
      return b.validFrom.localeCompare(a.validFrom);
    });
  }, [timetablesQuery.data]);

  // Find the "current" timetable: latest whose validFrom <= today
  const currentTimetableId = useMemo(() => {
    if (sortedTimetables.length === 0) {
      return null;
    }
    const today = dateToYYYYMMDD(new Date());
    const current = sortedTimetables.find(
      (t) => t.validFrom && t.validFrom <= today
    );
    return current?.id ?? sortedTimetables[0]?.id ?? null;
  }, [sortedTimetables]);

  const [selectedId, setSelectedId] = useState<string | null>(
    initialTimetableId ?? null
  );

  // Effective selection: use explicit selection, or fall back to current
  const effectiveId = selectedId ?? currentTimetableId;

  return {
    currentTimetableId,
    isLoading: timetablesQuery.isLoading,
    selectedTimetableId: effectiveId,
    setSelectedTimetableId: setSelectedId,
    timetables: sortedTimetables,
  };
}
