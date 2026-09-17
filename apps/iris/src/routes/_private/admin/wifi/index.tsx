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
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@filcdev/ui/components/card';
import { Input } from '@filcdev/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
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
import { RelativeTime } from '@/components/wifi/relative-time';
import { WifiAuthChart } from '@/components/wifi/wifi-auth-chart';
import { useWifiAdminStatsOverview, useWifiAuthLogs } from '@/hooks/wifi-admin';

export const Route = createFileRoute('/_private/admin/wifi/')({
  component: WifiDashboard,
});

function WifiDashboard() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useWifiAdminStatsOverview();

  if (isLoading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-destructive">
        {t('wifiAdminDashboard.loadErrorMessage')}
      </div>
    );
  }

  const { activeDevices, authSeries, totalDevices, totalUsers } = data;

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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t('wifiAdminDashboard.totalUsers')}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t('wifiAdminDashboard.totalDevices')}
            </CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalDevices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t('wifiAdminDashboard.activeDevices')}
            </CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{activeDevices}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>{t('wifiAdminDashboard.authentications')}</CardTitle>
        </CardHeader>
        <CardContent>
          <WifiAuthChart data={authSeries} />
        </CardContent>
      </Card>

      <WifiAuthLogs />
    </div>
  );
}

function WifiAuthLogs() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  const logsQuery = useWifiAuthLogs({
    limit,
    offset: page * limit,
    result: resultFilter === 'all' ? undefined : resultFilter === 'success',
    search: search || undefined,
  });

  const logs = logsQuery.data ?? [];

  return (
    <Card className="col-span-3 mt-4">
      <CardHeader>
        <CardTitle>
          {t('wifiAdminDashboard.authLogs', 'Authentication Logs')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={t(
                'wifiAdminDashboard.searchLogs',
                'Search username, MAC, NAS IP...'
              )}
              value={search}
            />
          </div>
          <Select
            onValueChange={(val) => {
              setResultFilter(val || 'all');
              setPage(0);
            }}
            value={resultFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue>
                {resultFilter === 'success'
                  ? t('wifiAdminDashboard.successOnly', 'Success only')
                  : resultFilter === 'failure'
                    ? t('wifiAdminDashboard.failuresOnly', 'Failures only')
                    : t('wifiAdminDashboard.allResults', 'All results')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('wifiAdminDashboard.allResults', 'All results')}
              </SelectItem>
              <SelectItem value="success">
                {t('wifiAdminDashboard.successOnly', 'Success only')}
              </SelectItem>
              <SelectItem value="failure">
                {t('wifiAdminDashboard.failuresOnly', 'Failures only')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wifiAdminDashboard.time', 'Time')}</TableHead>
                <TableHead>
                  {t('wifiAdminDashboard.username', 'Username')}
                </TableHead>
                <TableHead>
                  {t('wifiAdminDashboard.macAddress', 'MAC Address')}
                </TableHead>
                <TableHead>
                  {t('wifiAdminDashboard.nas', 'NAS IP/MAC')}
                </TableHead>
                <TableHead>
                  {t('wifiAdminDashboard.result', 'Result')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                if (logsQuery.isLoading) {
                  return (
                    <TableRow>
                      <TableCell className="text-center" colSpan={5}>
                        {t('common.loading')}
                      </TableCell>
                    </TableRow>
                  );
                }

                if (logs.length === 0) {
                  return (
                    <TableRow>
                      <TableCell
                        className="text-center text-muted-foreground"
                        colSpan={5}
                      >
                        {t('wifiAdminDashboard.noLogs', 'No logs found.')}
                      </TableCell>
                    </TableRow>
                  );
                }

                return logs.map((log) => (
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
                        <span className="font-mono text-xs">{log.macAddress}</span>
                        {log.deviceNickname ? (
                          <span className="text-muted-foreground text-xs">
                            {log.deviceNickname}
                          </span>
                        ) : log.deviceReportedHostname ? (
                          <span className="text-muted-foreground text-xs">
                            {log.deviceReportedHostname}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{log.nasIpAddress ?? '-'}</span>
                        <span className="font-mono text-muted-foreground text-xs">
                          {log.nasMacAddress ?? ''}
                        </span>
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
                          {t('wifiAdminDashboard.success', 'Success')}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          {log.failureReason ||
                            t('wifiAdminDashboard.failed', 'Failed')}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {t('wifiAdminDashboard.showingPage', 'Page {{page}}', {
              page: page + 1,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('common.previous')}
            </Button>
            <Button
              disabled={logs.length < limit}
              onClick={() => setPage((p) => p + 1)}
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
