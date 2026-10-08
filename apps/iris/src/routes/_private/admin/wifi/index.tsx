import { permissions } from '@filcdev/api/permissions';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@filcdev/ui/components/alert';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Input } from '@filcdev/ui/components/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { createFileRoute } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { RelativeTime } from '@/components/util/relative-time';
import { WifiAuthChart } from '@/components/wifi/wifi-auth-chart';
import { useWifiAdminStatsOverview, useWifiAuthLogs } from '@/hooks/wifi-admin';
import { orpc, prefetch } from '@/utils/orpc';

const LOGS_PAGE_SIZE = 20;

/** The wire enum is `'true' | 'false'`; the UI's tri-state maps onto it. */
const RESULT_FILTERS = ['all', 'success', 'failure'] as const;

type ResultFilter = (typeof RESULT_FILTERS)[number];

const resultFilterToWire = (
  filter: ResultFilter
): 'true' | 'false' | undefined => {
  if (filter === 'all') {
    return undefined;
  }
  return filter === 'success' ? 'true' : 'false';
};

export const Route = createFileRoute('/_private/admin/wifi/')({
  component: () => (
    <PermissionGuard permission={permissions.wifiRead}>
      <WifiDashboard />
    </PermissionGuard>
  ),
  loader: ({ context }) =>
    prefetch(context.queryClient, orpc.wifi.stats.overview.queryOptions()),
});

function WifiDashboard() {
  const { t } = useTranslation();
  const statsQuery = useWifiAdminStatsOverview();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('wifiAdminDashboard.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('wifiAdminDashboard.description')}
        </p>
      </div>

      <QueryBoundary
        data={statsQuery.data}
        error={(message) => (
          <Alert variant="destructive">
            <AlertTitle>{t('wifiAdminDashboard.loadError')}</AlertTitle>
            <AlertDescription>
              {message ?? t('wifiAdminDashboard.loadErrorMessage')}
            </AlertDescription>
          </Alert>
        )}
        loading={
          <div className="text-muted-foreground">{t('common.loading')}</div>
        }
        query={statsQuery}
      >
        {(stats) => (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                icon={Users}
                label={t('wifiAdminDashboard.totalUsers')}
                value={stats.totalUsers}
              />
              <StatCard
                icon={Smartphone}
                label={t('wifiAdminDashboard.totalDevices')}
                value={stats.totalDevices}
              />
              <StatCard
                icon={Wifi}
                label={t('wifiAdminDashboard.activeDevices')}
                value={stats.activeDevices}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('wifiAdminDashboard.authentications')}</CardTitle>
              </CardHeader>
              <CardContent>
                <WifiAuthChart data={stats.authSeries} />
              </CardContent>
            </Card>
          </>
        )}
      </QueryBoundary>

      <WifiAuthLogs />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="font-bold text-2xl">{value}</div>
      </CardContent>
    </Card>
  );
}

function WifiAuthLogs() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [page, setPage] = useState(0);

  const logsQuery = useWifiAuthLogs({
    limit: LOGS_PAGE_SIZE,
    offset: page * LOGS_PAGE_SIZE,
    result: resultFilterToWire(resultFilter),
    search: search || undefined,
  });

  const logs = logsQuery.data?.logs ?? [];
  const resultLabels: Record<ResultFilter, string> = {
    all: t('wifiAdminDashboard.allResults'),
    failure: t('wifiAdminDashboard.failuresOnly'),
    success: t('wifiAdminDashboard.successOnly'),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('wifiAdminDashboard.authLogs')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder={t('wifiAdminDashboard.searchLogs')}
              value={search}
            />
          </div>
          <Select
            items={RESULT_FILTERS.map((filter) => ({
              label: resultLabels[filter],
              value: filter,
            }))}
            onValueChange={(value) => {
              setResultFilter(value as ResultFilter);
              setPage(0);
            }}
            value={resultFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wifiAdminDashboard.time')}</TableHead>
                <TableHead>{t('wifiAdminDashboard.username')}</TableHead>
                <TableHead>{t('wifiAdminDashboard.macAddress')}</TableHead>
                <TableHead>{t('wifiAdminDashboard.nas')}</TableHead>
                <TableHead>{t('wifiAdminDashboard.result')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsQuery.isLoading && (
                <TableRow>
                  <TableCell className="text-center" colSpan={5}>
                    {t('common.loading')}
                  </TableCell>
                </TableRow>
              )}
              {!logsQuery.isLoading && logs.length === 0 && (
                <TableRow>
                  <TableCell
                    className="text-center text-muted-foreground"
                    colSpan={5}
                  >
                    {t('wifiAdminDashboard.noLogs')}
                  </TableCell>
                </TableRow>
              )}
              {!logsQuery.isLoading &&
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <RelativeTime date={log.timestamp} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{log.username}</span>
                        {log.userComment && (
                          <span className="text-muted-foreground text-xs">
                            {log.userComment}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">
                          {log.macAddress}
                        </span>
                        {(log.deviceNickname ?? log.deviceReportedHostname) && (
                          <span className="text-muted-foreground text-xs">
                            {log.deviceNickname ?? log.deviceReportedHostname}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">
                          {log.nasIpAddress ?? '-'}
                        </span>
                        {log.nasMacAddress && (
                          <span className="font-mono text-muted-foreground text-xs">
                            {log.nasMacAddress}
                          </span>
                        )}
                        {log.nasComment && (
                          <span className="text-muted-foreground text-xs">
                            {log.nasComment}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.result ? (
                        <Badge
                          className="border-green-600 text-green-600"
                          variant="outline"
                        >
                          {t('wifiAdminDashboard.success')}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          {log.failureReason ?? t('wifiAdminDashboard.failed')}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {t('wifiAdminDashboard.showingPage', { page: page + 1 })}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={page === 0}
              onClick={() => setPage((previous) => Math.max(0, previous - 1))}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('common.previous')}
            </Button>
            <Button
              disabled={logs.length < LOGS_PAGE_SIZE}
              onClick={() => setPage((previous) => previous + 1)}
              size="sm"
              variant="outline"
            >
              {t('common.next')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
