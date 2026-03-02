import { useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { SubsV } from './subs';

type SubstitutionsResponse = InferResponseType<
  typeof api.timetable.substitutions.$get
>;

type Subs = NonNullable<SubstitutionsResponse['data']>[number];

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

  const groupedEntries = Object.entries(groupedData).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hasFutureSubstitutions = substitutionsQuery.data?.some(
    (sub) => new Date(sub.substitution.date) >= today
  );

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
        {!(isLoading || hasError) && hasFutureSubstitutions
          ? groupedEntries.map(([date, data]) => (
              <SubsV data={data} key={date} />
            ))
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
