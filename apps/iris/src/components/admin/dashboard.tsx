import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@filcdev/ui/components/chart';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { Separator } from '@filcdev/ui/components/separator';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import type { InferResponseType } from 'hono/client';
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
import { useApiQuery } from '@/utils/api';
import { api } from '@/utils/hc';

type StatsResponse = InferResponseType<typeof api.dashboard.stats.$get>;
type DashboardStats = NonNullable<StatsResponse['data']>['stats'];
type ChartPoint = NonNullable<DashboardStats['chartData']>[number];

type ChartTotals = {
  movedLessons: number;
  substitutions: number;
};

type DashboardStatCardsProps = {
  isError: boolean;
  isLoading: boolean;
  stats: DashboardStats | undefined;
};

function DashboardStatCards({
  isError,
  isLoading,
  stats,
}: DashboardStatCardsProps) {
  const { t } = useTranslation();

  if (isError) {
    return (
      <p className="col-span-full text-destructive text-sm">
        {t('dashboard.loadError')}
      </p>
    );
  }

  return (
    <>
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
    </>
  );
}

type DashboardActivityChartProps = {
  chartConfig: ChartConfig;
  isError: boolean;
  isLoading: boolean;
  points: ChartPoint[];
  stats: DashboardStats | undefined;
};

function DashboardActivityChart({
  chartConfig,
  isError,
  isLoading,
  points,
  stats,
}: DashboardActivityChartProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <Skeleton className="h-64 w-full sm:h-80" />;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">{t('dashboard.loadError')}</p>
    );
  }

  if (!stats || points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t('dashboard.noActivity')}
      </p>
    );
  }

  return (
    <ChartContainer className="h-64 w-full sm:h-80" config={chartConfig}>
      <BarChart
        data={points}
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

type DashboardSummaryProps = {
  isError: boolean;
  isLoading: boolean;
  stats: DashboardStats | undefined;
  totals: ChartTotals;
};

function DashboardSummary({
  isError,
  isLoading,
  stats,
  totals,
}: DashboardSummaryProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">{t('dashboard.loadError')}</p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span>{t('dashboard.totalUsers')}</span>
        <span className="font-semibold">{stats?.totalUsers ?? 0}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>{t('dashboard.totalSubstitutions')}</span>
        <span className="font-semibold">{totals.substitutions}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>{t('dashboard.totalMovedLessons')}</span>
        <span className="font-semibold">{totals.movedLessons}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>{t('dashboard.totalCohorts')}</span>
        <span className="font-semibold">{stats?.totalCohorts ?? 0}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>{t('dashboard.totalRoles')}</span>
        <span className="font-semibold">{stats?.totalRoles ?? 0}</span>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const [days, setDays] = useState(30);

  const dayItems = [
    { label: t('dashboard.today'), value: '1' },
    { label: t('dashboard.last7Days'), value: '7' },
    { label: t('dashboard.last30Days'), value: '30' },
    { label: t('dashboard.last90Days'), value: '90' },
    { label: t('dashboard.lastYear'), value: '365' },
  ];

  const statsQuery = useApiQuery<NonNullable<StatsResponse['data']>>(
    () => api.dashboard.stats.$get({ query: { days: String(days) } }),
    {
      queryKey: ['dashboard', 'stats', days] as const,
    }
  );

  const stats: DashboardStats | undefined = statsQuery.data?.stats;
  const isLoading = statsQuery.isLoading;

  const filteredChartData = useMemo(() => {
    if (!(stats?.chartData && days === 7)) {
      return stats?.chartData ?? [];
    }
    // For the week view, show only working days (Mon-Fri).
    // Parse YYYY-MM-DD in UTC to avoid timezone-based day misclassification.
    return stats.chartData.filter((point) => {
      const parts = point.date.split('-').map(Number);
      const y = parts[0] ?? 0;
      const m = parts[1] ?? 0;
      const d = parts[2] ?? 0;
      const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      return day !== 0 && day !== 6;
    });
  }, [stats?.chartData, days]);

  const summaryChartTotals = useMemo(() => {
    let substitutions = 0;
    let movedLessons = 0;
    for (const point of filteredChartData) {
      substitutions += point.substitutions;
      movedLessons += point.movedLessons;
    }
    return { movedLessons, substitutions };
  }, [filteredChartData]);

  const chartConfig = useMemo(
    () =>
      ({
        movedLessons: {
          color: 'var(--chart-2)',
          label: t('dashboard.totalMovedLessons'),
        },
        substitutions: {
          color: 'var(--primary)',
          label: t('dashboard.totalSubstitutions'),
        },
      }) satisfies ChartConfig,
    [t]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('dashboard.title')}
        </h1>
        <p className="text-muted-foreground">{t('dashboard.description')}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <DashboardStatCards
          isError={statsQuery.isError}
          isLoading={isLoading}
          stats={stats}
        />
      </div>
      <Separator />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.activityChart')}</CardTitle>
            <Select
              items={dayItems}
              onValueChange={(v) => setDays(Number(v))}
              value={String(days)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
            </Select>
          </CardHeader>
          <CardContent>
            <DashboardActivityChart
              chartConfig={chartConfig}
              isError={statsQuery.isError}
              isLoading={isLoading}
              points={filteredChartData}
              stats={stats}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.summary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardSummary
              isError={statsQuery.isError}
              isLoading={isLoading}
              stats={stats}
              totals={summaryChartTotals}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
