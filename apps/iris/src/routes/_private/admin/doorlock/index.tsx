import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { type InferResponseType, parseResponse } from 'hono/client';
import { DoorOpen, IdCard, Microchip } from 'lucide-react';
import type { ReactNode } from 'react';
import { DoorOpenChart } from '@/components/doorlock/door-open-chart';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/util/permission-guard';
import { api } from '@/utils/hc';

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
  const statsQuery = useQuery({
    queryFn: async (): Promise<DoorlockStatsOverview> => {
      const res = await parseResponse(api.doorlock.stats.overview.$get());
      if (!(res.success && res.data?.stats)) {
        throw new Error('Failed to load stats');
      }
      return res.data.stats as DoorlockStatsOverview;
    },
    queryKey: ['doorlock', 'stats'],
  });

  if (statsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load statistics</AlertTitle>
        <AlertDescription>
          {(statsQuery.error as Error)?.message ??
            'Something went wrong while fetching the dashboard.'}
        </AlertDescription>
      </Alert>
    );
  }

  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<IdCard className="text-primary" />}
          isLoading={!stats}
          label="Total cards"
          value={stats?.totalCards ?? 0}
        />
        <StatCard
          icon={<Microchip className="text-primary" />}
          isLoading={!stats}
          label="Total devices"
          value={stats?.totalDevices ?? 0}
        />
        <StatCard
          icon={<DoorOpen className="text-primary" />}
          isLoading={!stats}
          label="Successful opens"
          value={stats?.totalSuccessfulOpens ?? 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Door opens (last 7 days)</CardTitle>
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
            <CardTitle>Top users</CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? (
              <ul className="space-y-3">
                {stats.topUsers.length === 0 && (
                  <li className="text-muted-foreground text-sm">
                    No activity recorded
                  </li>
                )}
                {stats.topUsers.map((user) => (
                  <li
                    className="flex items-center justify-between text-sm"
                    key={user.id}
                  >
                    <span>{user.nickname ?? user.name ?? 'Unknown user'}</span>
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

type StatCardProps = {
  icon: ReactNode;
  isLoading: boolean;
  label: string;
  value: number;
};

function StatCard({ icon, isLoading, label, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="font-bold text-3xl">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
