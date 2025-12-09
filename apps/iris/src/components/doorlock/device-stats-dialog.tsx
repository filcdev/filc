import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { parseResponse } from 'hono/client';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
import { api } from '@/utils/hc';

type DeviceStatsDialogProps = {
  deviceId: string | null;
  deviceName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type DeviceStat = {
  debug: {
    deviceState: string;
    errors: Record<string, boolean>;
    lastResetReason: string;
  };
  fwVersion: string;
  id: number;
  ramFree: number;
  storage: {
    total: number;
    used: number;
  };
  timestamp: string;
  uptime: number;
};

export function DeviceStatsDialog({
  deviceId,
  deviceName,
  onOpenChange,
  open,
}: DeviceStatsDialogProps) {
  const statsQuery = useQuery<DeviceStat[]>({
    enabled: !!deviceId && open,
    queryFn: async () => {
      if (!deviceId) {
        return [];
      }
      const res = await parseResponse(
        api.doorlock.devices[':id'].stats.$get({
          param: { id: deviceId },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load stats');
      }
      return (res.data as unknown as { stats: DeviceStat[] }).stats;
    },
    queryKey: ['doorlock', 'devices', deviceId, 'stats'],
    refetchInterval: 30_000, // Refresh every 30s
  });

  const chartData = useMemo(() => {
    if (!statsQuery.data) {
      return [];
    }
    return statsQuery.data
      .map((stat) => ({
        ...stat,
        formattedTime: dayjs(stat.timestamp).format('HH:mm:ss'),
        ramFreeKb: Math.round(stat.ramFree / 1024),
        uptimeHours: Math.round((stat.uptime / 3600 / 1000) * 10) / 10,
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
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        )}

        {statsQuery.isError && (
          <div className="text-destructive">Failed to load statistics.</div>
        )}

        {statsQuery.isSuccess && (
          <ScrollArea className="h-[80vh] pr-4">
            <div className="space-y-8">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">Firmware</div>
                  <div className="font-bold font-mono">
                    {latestStat?.fwVersion ?? 'N/A'}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">Uptime</div>
                  <div className="font-bold font-mono">
                    {latestStat
                      ? `${Math.round(latestStat.uptime / 3_600_000)}h`
                      : 'N/A'}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">Free RAM</div>
                  <div className="font-bold font-mono">
                    {latestStat
                      ? `${Math.round(latestStat.ramFree / 1024)} KB`
                      : 'N/A'}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">Storage</div>
                  <div className="font-bold font-mono">
                    {latestStat
                      ? `${Math.round(
                          (latestStat.storage.used / latestStat.storage.total) *
                            100
                        )}%`
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* RAM Chart */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Free RAM (KB)</h3>
                <div className="h-[200px] w-full rounded-lg border bg-card p-4">
                  <ResponsiveContainer height="100%" width="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="formattedTime"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis fontSize={12} tickLine={false} />
                      <Tooltip />
                      <Area
                        dataKey="ramFreeKb"
                        fill="var(--color-primary)"
                        fillOpacity={0.2}
                        stroke="var(--color-primary)"
                        type="monotone"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Uptime Chart */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Uptime (Hours)</h3>
                <div className="h-[200px] w-full rounded-lg border bg-card p-4">
                  <ResponsiveContainer height="100%" width="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="formattedTime"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis fontSize={12} tickLine={false} />
                      <Tooltip />
                      <Line
                        dataKey="uptimeHours"
                        dot={false}
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        type="monotone"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent History Table */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Recent History</h3>
                <div className="rounded-md border">
                  <Table>
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
                          <TableCell>{stat.debug.deviceState}</TableCell>
                          <TableCell>{stat.debug.lastResetReason}</TableCell>
                          <TableCell>
                            {Object.entries(stat.debug.errors)
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
