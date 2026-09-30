import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { ScrollArea } from '@filcdev/ui/components/scroll-area';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import { Lazy } from '@/components/lazy';
import { useDoorlockDeviceStats } from '@/hooks/doorlock-admin';

// recharts is only needed once the dialog is open, and it is the heaviest
// import on the devices page.
const loadDeviceStatsCharts = () =>
  import('@/components/doorlock/device-stats-charts');

type DeviceStatsDialogProps = {
  deviceId: string | null;
  deviceName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function DeviceStatsDialog({
  deviceId,
  deviceName,
  onOpenChange,
  open,
}: DeviceStatsDialogProps) {
  const statsQuery = useDoorlockDeviceStats(deviceId, open);

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

              <Lazy
                chartData={chartData}
                fallback={
                  <div className="space-y-4">
                    <Skeleton className="h-50 w-full" />
                    <Skeleton className="h-50 w-full" />
                  </div>
                }
                load={loadDeviceStatsCharts}
              />

              {/* Recent History Table */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Recent History</h3>
                <div className="rounded-md border">
                  <Table className="w-full min-w-3xl table-fixed">
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
