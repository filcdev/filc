import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '~/frontend/components/ui/chart';

const chartConfig = {
  opens: {
    color: 'hsl(var(--primary))',
    label: 'Door opens',
  },
};

export type DoorOpenDatapoint = {
  count: number;
  date: string;
};

export function DoorOpenChart({ data }: { data: DoorOpenDatapoint[] }) {
  return (
    <ChartContainer className="h-[320px] w-full" config={chartConfig}>
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data} margin={{ bottom: 8, left: 12, right: 12 }}>
          <XAxis
            axisLine={false}
            dataKey="date"
            tickLine={false}
            tickMargin={8}
          />
          <YAxis allowDecimals={false} tickMargin={8} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="count"
            dot={false}
            stroke="var(--color-opens, hsl(var(--primary)))"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
