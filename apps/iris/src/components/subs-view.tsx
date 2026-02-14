import { useQuery } from '@tanstack/react-query';
import { parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { SubsV } from './subs';

type Lesson = {
  id: string;
  subject: {
    id: string;
    name: string;
    short: string;
  } | null;
  classrooms: {
    id: string;
    name: string;
    short: string;
  }[];
  cohorts: string[];
  day: {
    id: string;
    name: string;
    short: string;
    days: string[];
    createdAt: string;
    updatedAt: string;
  } | null;
  period: {
    id: string;
    period: number;
    startTime: string;
    endTime: string;
  } | null;
  periodsPerWeek: number;
  teachers: {
    id: string;
    name: string;
    short: string;
  }[];
  termDefinitionId: string | null;
  weeksDefinitionId: string;
};

type Subs = {
  lessons: Lesson[];
  substitution: {
    date: string;
    id: string;
    substituter: string | null;
  };
  teacher: {
    firstName: string;
    gender: string | null;
    id: string;
    lastName: string;
    short: string;
    userId: string | null;
  } | null;
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

export function SubstitutionView() {
  const { isPending } = authClient.useSession();
  const { t } = useTranslation();

  const substitutionsQuery = useQuery({
    enabled: !isPending,
    queryFn: async () => {
      const res = await parseResponse(api.timetable.substitutions.$get());
      if (!res.success) {
        throw new Error('Failed to load substitutions');
      }

      return res.data as Subs[];
    },
    queryKey: ['substitutions'],
  });

  const isLoading =
    substitutionsQuery.isLoading || substitutionsQuery.isFetching;
  const hasError = substitutionsQuery.error;

  const groupedData = substitutionsQuery.data
    ? groupByDate(substitutionsQuery.data)
    : {};

  return (
    <div className="flex grow flex-col items-center gap-4 p-4">
      <div className="flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-2xl">Substitutions</h1>
        </div>
      </div>
      {isLoading && <Skeleton className="h-64 w-full max-w-5xl" />}
      {hasError && (
        <div className="w-full max-w-5xl">
          <p className="text-red-500">{t('substitution.loadError')}</p>
        </div>
      )}
      <div className="w-full max-w-5xl">
        {!(isLoading || hasError) &&
          Object.entries(groupedData).map(([date, data]) => (
            <SubsV data={data} key={date} />
          ))}
      </div>
    </div>
  );
}
