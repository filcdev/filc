import type { WifiStatsOverview } from '@filcdev/api/domains/wifi/stats';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@filcdev/ui/components/chart';

const chartConfig = {
  accepted: {
    color: 'var(--primary)',
    label: 'Accepted',
  },
  rejected: {
    color: 'var(--destructive)',
    label: 'Rejected',
  },
} satisfies ChartConfig;

export function WifiAuthChart({
  data,
}: {
  data: WifiStatsOverview['authSeries'];
}) {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    const dataByDate = new Map(
      data.map((entry) => [
        entry.date,
        { accepted: entry.accepted, rejected: entry.rejected },
      ])
    );

    return Array.from({ length: 7 }, (_, index) => {
      const date = dayjs()
        .subtract(6 - index, 'day')
        .format('YYYY-MM-DD');

      const entry = dataByDate.get(date) ?? { accepted: 0, rejected: 0 };

      return {
        accepted: entry.accepted,
        date,
        label: dayjs(date).format('MMM D'),
        rejected: entry.rejected,
      };
    });
  }, [data]);

  return (
    <ChartContainer className="h-80 w-full" config={chartConfig}>
      <LineChart
        data={chartData}
        margin={{ bottom: 8, left: 12, right: 12, top: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          tickMargin={8}
          width={40}
        />
        <ChartTooltip
          content={<ChartTooltipContent />}
          labelFormatter={(_, payload) => payload?.[0]?.payload.date ?? ''}
        />
        <Line
          activeDot={{ r: 4 }}
          dataKey="accepted"
          dot={{ fill: 'var(--color-accepted)', r: 3, strokeWidth: 0 }}
          name={t('wifiAdminDashboard.accepted', 'Accepted')}
          stroke="var(--color-accepted)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          activeDot={{ r: 4 }}
          dataKey="rejected"
          dot={{ fill: 'var(--color-rejected)', r: 3, strokeWidth: 0 }}
          name={t('wifiAdminDashboard.rejected', 'Rejected')}
          stroke="var(--color-rejected)"
          strokeWidth={2}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}
