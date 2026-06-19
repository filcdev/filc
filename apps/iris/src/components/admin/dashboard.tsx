import { useQuery } from '@tanstack/react-query';
import { type InferResponseType, parseResponse } from 'hono/client';
import {
  ArrowLeftRight,
  ArrowRightLeft,
  GraduationCap,
  Shield,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { StatCard } from '@/components/admin/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/utils/hc';

const chartConfig = {
  movedLessons: {
    color: 'var(--chart-2)',
    label: 'Moved Lessons',
  },
  substitutions: {
    color: 'var(--primary)',
    label: 'Substitutions',
  },
} satisfies ChartConfig;

type StatsResponse = InferResponseType<typeof api.dashboard.stats.$get>;
type DashboardStats = NonNullable<StatsResponse['data']>['stats'];

export function AdminDashboard() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);

  const statsQuery = useQuery({
    queryFn: async (): Promise<DashboardStats> => {
      const res = await parseResponse(
        api.dashboard.stats.$get({ query: { days } })
      );
      if (!(res.success && res.data?.stats)) {
        throw new Error('Failed to load dashboard stats');
      }
      return res.data.stats as DashboardStats;
    },
    queryKey: ['dashboard', 'stats', days] as const,
  });

  const stats = statsQuery.data;
  const isLoading = statsQuery.isLoading;

  const filteredChartData = useMemo(() => {
    if (!stats?.chartData) {
      return [];
    }
    if (days !== 7) {
      return stats.chartData;
    }
    // For the week view, show only working days (Mon-Fri)
    return stats.chartData.filter((point) => {
      const d = new Date(point.date);
      const day = d.getDay();
      return day !== 0 && day !== 6;
    });
  }, [stats?.chartData, days]);

  let chartContent: React.ReactNode;
  if (isLoading) {
    chartContent = <Skeleton className="h-80 w-full" />;
  } else if (!stats || filteredChartData.length === 0) {
    chartContent = (
      <p className="text-muted-foreground text-sm">
        {t('dashboard.noActivity')}
      </p>
    );
  } else {
    chartContent = (
      <ChartContainer className="h-80 w-full" config={chartConfig}>
        <BarChart
          data={filteredChartData}
          margin={{ bottom: 8, left: 12, right: 12, top: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="date"
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            tickMargin={8}
            width={40}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="substitutions"
            fill="var(--color-substitutions)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="movedLessons"
            fill="var(--color-movedLessons)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('dashboard.title')}
        </h1>
        <p className="text-muted-foreground">{t('dashboard.description')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<Users className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.totalUsers')}
          value={stats?.totalUsers ?? 0}
        />
        <StatCard
          icon={<ArrowRightLeft className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.totalSubstitutions')}
          value={stats?.totalSubstitutions ?? 0}
        />
        <StatCard
          icon={<ArrowLeftRight className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.totalMovedLessons')}
          value={stats?.totalMovedLessons ?? 0}
        />
        <StatCard
          icon={<GraduationCap className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.totalCohorts')}
          value={stats?.totalCohorts ?? 0}
        />
        <StatCard
          icon={<Shield className="text-primary" />}
          isLoading={isLoading}
          label={t('dashboard.totalRoles')}
          value={stats?.totalRoles ?? 0}
        />
      </div>
      <Separator />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.activityChart')}</CardTitle>
            <Select
              onValueChange={(v) => setDays(Number(v))}
              value={String(days)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t('dashboard.today')}</SelectItem>
                <SelectItem value="7">{t('dashboard.last7Days')}</SelectItem>
                <SelectItem value="30">{t('dashboard.last30Days')}</SelectItem>
                <SelectItem value="90">{t('dashboard.last90Days')}</SelectItem>
                <SelectItem value="365">{t('dashboard.lastYear')}</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>{chartContent}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.summary')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{t('dashboard.totalUsers')}</span>
                  <span className="font-semibold">
                    {stats?.totalUsers ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('dashboard.totalSubstitutions')}</span>
                  <span className="font-semibold">
                    {stats?.chartTotalSubstitutions ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('dashboard.totalMovedLessons')}</span>
                  <span className="font-semibold">
                    {stats?.chartTotalMovedLessons ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('dashboard.totalCohorts')}</span>
                  <span className="font-semibold">
                    {stats?.totalCohorts ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('dashboard.totalRoles')}</span>
                  <span className="font-semibold">
                    {stats?.totalRoles ?? 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
