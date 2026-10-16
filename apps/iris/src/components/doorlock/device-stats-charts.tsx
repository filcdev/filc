import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@filcdev/ui/components/chart';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';

const ramChartConfig = {
  ramFreeKb: {
    color: 'var(--color-primary)',
    label: 'Free RAM (KB)',
  },
} satisfies ChartConfig;

const uptimeChartConfig = {
  uptimeHours: {
    color: 'var(--color-primary)',
    label: 'Uptime (Hours)',
  },
} satisfies ChartConfig;

/** One reading of a device's stats, shaped for the two charts. */
type DeviceChartPoint = {
  formattedTime: string;
  ramFreeKb: number;
  timestamp: Date;
  uptimeHours: number;
};

/**
 * The dialog's two charts, in their own module so recharts is only fetched when
 * the dialog is opened.
 */
export default function DeviceStatsCharts({
  chartData,
}: {
  chartData: DeviceChartPoint[];
}) {
  return (
    <>
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Free RAM (KB)</h3>
        <ChartContainer className="h-50 w-full" config={ramChartConfig}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="formattedTime" fontSize={12} tickLine={false} />
            <YAxis fontSize={12} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="ramFreeKb"
              fill="var(--color-ramFreeKb)"
              fillOpacity={0.2}
              stroke="var(--color-ramFreeKb)"
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Uptime (Hours)</h3>
        <ChartContainer className="h-50 w-full" config={uptimeChartConfig}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="formattedTime" fontSize={12} tickLine={false} />
            <YAxis fontSize={12} tickLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="uptimeHours"
              dot={false}
              stroke="var(--color-uptimeHours)"
              strokeWidth={2}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </div>
    </>
  );
}
