import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { type InferResponseType, parseResponse } from 'hono/client';
import { DoorOpen, IdCard, Microchip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '@/components/admin/stat-card';
import { DoorOpenChart } from '@/components/doorlock/door-open-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/util/permission-guard';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type StatsResponse = InferResponseType<typeof api.doorlock.stats.overview.$get>;
type DoorlockStatsOverview = NonNullable<StatsResponse['data']>['stats'];

export const Route = createFileRoute('/_private/admin/doorlock/')({
  component: () => (
    <PermissionGuard permission="doorlock:stats:read">
      <DoorlockDashboard />
    </PermissionGuard>
  ),
});

function DoorlockDashboard() {
  const { t } = useTranslation();

  const statsQuery = useQuery({
    queryFn: async (): Promise<DoorlockStatsOverview> => {
      const res = await parseResponse(api.doorlock.stats.overview.$get());
      if (!(res.success && res.data?.stats)) {
        throw new Error('Failed to load stats');
      }
      return res.data.stats as DoorlockStatsOverview;
    },
    queryKey: queryKeys.doorlock.stats(),
  });

  const stats = statsQuery.data;
  const isLoading = !stats && !statsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('doorlockDashboard.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('doorlockDashboard.description')}
        </p>
      </div>

      {statsQuery.isError && (
        <Alert variant="destructive">
          <AlertTitle>{t('doorlockDashboard.loadError')}</AlertTitle>
          <AlertDescription>
            {(statsQuery.error as Error)?.message ??
              t('doorlockDashboard.loadErrorMessage')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<IdCard className="text-primary" />}
          isLoading={isLoading}
          label={t('doorlockDashboard.totalCards')}
          value={stats?.totalCards ?? 0}
        />
        <StatCard
          icon={<Microchip className="text-primary" />}
          isLoading={isLoading}
          label={t('doorlockDashboard.totalDevices')}
          value={stats?.totalDevices ?? 0}
        />
        <StatCard
          icon={<DoorOpen className="text-primary" />}
          isLoading={isLoading}
          label={t('doorlockDashboard.successfulOpens')}
          value={stats?.totalSuccessfulOpens ?? 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('doorlockDashboard.doorOpens')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? (
              <DoorOpenChart data={stats.doorOpenSeries} />
            ) : (
              <Skeleton className="h-80 w-full" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('doorlockDashboard.topUsers')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? (
              <ul className="space-y-3">
                {stats.topUsers.length === 0 && (
                  <li className="text-muted-foreground text-sm">
                    {t('unknown')}
                  </li>
                )}
                {stats.topUsers.map((user) => (
                  <li
                    className="flex items-center justify-between text-sm"
                    key={user.id}
                  >
                    <span>{user.nickname ?? user.name ?? t('unknown')}</span>
                    <span className="font-semibold">{user.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
