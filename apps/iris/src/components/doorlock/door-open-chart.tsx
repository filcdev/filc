import dayjs from 'dayjs';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type DoorOpenDatapoint = {
  count: number;
  date: string;
};

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
    <div className="h-80 w-full rounded-lg border bg-card p-4">
      <ResponsiveContainer height="100%" width="100%">
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
          <Tooltip
            formatter={(value) => [value, 'Door opens']}
            labelFormatter={(_, payload) => payload?.[0]?.payload.date ?? ''}
          />
          <Line
            activeDot={{ r: 4 }}
            dataKey="count"
            dot={{ fill: 'var(--color-primary)', r: 3, strokeWidth: 0 }}
            stroke="var(--color-primary)"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
