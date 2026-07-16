import dayjs from 'dayjs';
import type { InferResponseType } from 'hono/client';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApiQuery } from '@/utils/api';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type DeviceStatsResponse = InferResponseType<
  (typeof api.doorlock.devices)[':id']['stats']['$get']
>;
type DeviceStat = NonNullable<DeviceStatsResponse['data']>[number];

type DeviceStatsDialogProps = {
  deviceId: string | null;
  deviceName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

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

export function DeviceStatsDialog({
  deviceId,
  deviceName,
  onOpenChange,
  open,
}: DeviceStatsDialogProps) {
  const statsQuery = useApiQuery<DeviceStat[]>(
    () => {
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled`
      const id = deviceId!;
      return api.doorlock.devices[':id'].stats.$get({
        param: { id },
      });
    },
    {
      enabled: !!deviceId && open,
      queryKey: queryKeys.doorlock.deviceStats(deviceId ?? ''),
      refetchInterval: 30_000, // Refresh every 30s
    }
  );

  const chartData = useMemo(() => {
    if (!statsQuery.data) {
      return [];
    }
    return statsQuery.data
      .map((stat) => ({
        ...stat,
        formattedTime: dayjs(stat.timestamp).format('HH:mm:ss'),
        ramFreeKb: Math.round(stat.deviceMeta.ramFree / 1024),
        uptimeHours:
          Math.round((stat.deviceMeta.uptime / 3600 / 1000) * 10) / 10,
      }))
      .reverse();
  }, [statsQuery.data]);

  const latestStat = statsQuery.data?.[0];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Device Statistics: {deviceName}</DialogTitle>
        </DialogHeader>

        {statsQuery.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-50 w-full" />
            <Skeleton className="h-50 w-full" />
          </div>
        )}

        {statsQuery.isError && (
          <div className="text-destructive">Failed to load statistics.</div>
        )}

        {statsQuery.isSuccess && (
          <ScrollArea className="h-[80vh] w-full overflow-x-hidden">
            <div className="space-y-8 pr-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">Firmware</div>
                  <div className="font-bold font-mono">
                    {latestStat?.deviceMeta.fwVersion ?? 'N/A'}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">Uptime</div>
                  <div className="font-bold font-mono">
                    {latestStat
                      ? `${Math.round(latestStat.deviceMeta.uptime / 3_600_000)}h`
                      : 'N/A'}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">Free RAM</div>
                  <div className="font-bold font-mono">
                    {latestStat
                      ? `${Math.round(latestStat.deviceMeta.ramFree / 1024)} KB`
                      : 'N/A'}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">Storage</div>
                  <div className="font-bold font-mono">
                    {latestStat
                      ? `${Math.round(
                          (latestStat.deviceMeta.storage.used /
                            latestStat.deviceMeta.storage.total) *
                            100
                        )}%`
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* RAM Chart */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Free RAM (KB)</h3>
                <ChartContainer className="h-50 w-full" config={ramChartConfig}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="formattedTime"
                      fontSize={12}
                      tickLine={false}
                    />
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

              {/* Uptime Chart */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Uptime (Hours)</h3>
                <ChartContainer
                  className="h-50 w-full"
                  config={uptimeChartConfig}
                >
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="formattedTime"
                      fontSize={12}
                      tickLine={false}
                    />
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

              {/* Recent History Table */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Recent History</h3>
                <div className="rounded-md border">
                  <Table className="w-full table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Reset Reason</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statsQuery.data?.slice(0, 10).map((stat) => (
                        <TableRow key={stat.id}>
                          <TableCell className="font-mono text-xs">
                            {dayjs(stat.timestamp).format(
                              'YYYY-MM-DD HH:mm:ss'
                            )}
                          </TableCell>
                          <TableCell className="wrap-break-word">
                            {stat.deviceMeta.debug.deviceState}
                          </TableCell>
                          <TableCell className="wrap-break-word">
                            {stat.deviceMeta.debug.lastResetReason}
                          </TableCell>
                          <TableCell className="wrap-break-word">
                            {Object.entries(stat.deviceMeta.debug.errors)
                              .filter(([_, v]) => v)
                              .map(([k]) => k)
                              .join(', ') || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
