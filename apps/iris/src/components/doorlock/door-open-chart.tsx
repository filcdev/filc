import dayjs from 'dayjs';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export type DoorOpenDatapoint = {
  count: number;
  date: string;
};

const chartConfig = {
  count: {
    color: 'hsl(var(--primary))',
    label: 'Door opens',
  },
} satisfies ChartConfig;

export function DoorOpenChart({ data }: { data: DoorOpenDatapoint[] }) {
  const chartData = useMemo(() => {
    const countsByDate = new Map(
      data.map((entry) => [entry.date, entry.count])
    );

    return Array.from({ length: 7 }, (_, index) => {
      const date = dayjs()
        .subtract(6 - index, 'day')
        .format('YYYY-MM-DD');

      return {
        count: countsByDate.get(date) ?? 0,
        date,
        label: dayjs(date).format('MMM D'),
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
          formatter={(value) => [value, 'Door opens']}
          labelFormatter={(_, payload) => payload?.[0]?.payload.date ?? ''}
        />
        <Line
          activeDot={{ r: 4 }}
          dataKey="count"
          dot={{ fill: 'var(--color-count)', r: 3, strokeWidth: 0 }}
          stroke="var(--color-count)"
          strokeWidth={2}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}
