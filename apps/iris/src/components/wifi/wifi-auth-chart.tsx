import type { WifiStatsOverview } from '@filcdev/api/domains/wifi/stats';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@filcdev/ui/components/chart';
import dayjs from 'dayjs';
import 'dayjs/locale/hu';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

const SERIES_DAYS = 7;

const chartConfig = {
  accepted: { color: 'var(--primary)', label: 'Accepted' },
  rejected: { color: 'var(--destructive)', label: 'Rejected' },
} satisfies ChartConfig;

/**
 * Accepted vs rejected authentications over the last week. The server returns
 * only the days that have attempts, so the series is zero-filled to a fixed
 * seven-day window here.
 */
export function WifiAuthChart({
  data,
}: {
  data: WifiStatsOverview['authSeries'];
}) {
  const { i18n, t } = useTranslation();
  const language = i18n.language;

  const chartData = useMemo(() => {
    const byDate = new Map(
      data.map((entry) => [
        entry.date,
        { accepted: entry.accepted, rejected: entry.rejected },
      ])
    );

    return Array.from({ length: SERIES_DAYS }, (_, index) => {
      const date = dayjs()
        .subtract(SERIES_DAYS - 1 - index, 'day')
        .format('YYYY-MM-DD');
      const entry = byDate.get(date) ?? { accepted: 0, rejected: 0 };

      return {
        accepted: entry.accepted,
        date,
        label: dayjs(date).locale(language).format('MMM D'),
        rejected: entry.rejected,
      };
    });
  }, [data, language]);

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
          name={t('wifiAdminDashboard.accepted')}
          stroke="var(--color-accepted)"
          strokeWidth={2}
          type="monotone"
        />
        <Line
          activeDot={{ r: 4 }}
          dataKey="rejected"
          dot={{ fill: 'var(--color-rejected)', r: 3, strokeWidth: 0 }}
          name={t('wifiAdminDashboard.rejected')}
          stroke="var(--color-rejected)"
          strokeWidth={2}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}
