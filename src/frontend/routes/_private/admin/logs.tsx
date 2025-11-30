import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { type InferResponseType, parseResponse } from 'hono/client';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useDeferredValue, useMemo, useState } from 'react';
import { FaCalendar, FaCheck, FaDoorOpen, FaUser } from 'react-icons/fa6';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '~/frontend/components/ui/alert';
import { Badge } from '~/frontend/components/ui/badge';
import { Button } from '~/frontend/components/ui/button';
import { Calendar } from '~/frontend/components/ui/calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '~/frontend/components/ui/card';
import { Input } from '~/frontend/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverPositioner,
  PopoverTrigger,
} from '~/frontend/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectPositioner,
  SelectTrigger,
  SelectValue,
} from '~/frontend/components/ui/select';
import { Skeleton } from '~/frontend/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/frontend/components/ui/table';
import { PermissionGuard } from '~/frontend/components/util/permission-guard';
import { authClient } from '~/frontend/utils/authentication';
import { apiClient } from '~/frontend/utils/hc';
import { cn } from '~/frontend/utils/index';

type DevicesResponse = InferResponseType<
  typeof apiClient.doorlock.devices.$get
>;
type CardsResponse = InferResponseType<typeof apiClient.doorlock.cards.$get>;
type LogsResponse = InferResponseType<typeof apiClient.doorlock.logs.$get>;

type DoorlockDevice = NonNullable<DevicesResponse['data']>['devices'][number];
type DoorlockCard = NonNullable<CardsResponse['data']>['cards'][number];
type DoorlockLogEntry = NonNullable<LogsResponse['data']>['logs'][number];

type EventFilter = 'all' | 'virtual' | 'physical';

const isVirtualLog = (log: DoorlockLogEntry) =>
  Boolean(log.buttonPressed && log.cardId);

type ButtonMeta = {
  caption?: string;
  label: string;
  variant: 'default' | 'outline' | 'secondary';
};

const buildButtonMeta = (log: DoorlockLogEntry): ButtonMeta => {
  if (isVirtualLog(log)) {
    return {
      caption: 'Triggered via Chronos app',
      label: 'Virtual card',
      variant: 'secondary',
    };
  }

  if (log.buttonPressed) {
    return {
      label: 'Physical button',
      variant: 'outline',
    };
  }

  return {
    label: 'Card swipe',
    variant: 'default',
  };
};

export const Route = createFileRoute('/_private/admin/logs')({
  component: () => (
    <PermissionGuard permission="doorlock:logs:read">
      <LogsPage />
    </PermissionGuard>
  ),
});

const DEFAULT_LIMIT = '500';

type DateRange = {
  from?: Date;
  to?: Date;
};

type FilterOption = {
  id: string;
  label: string;
};

type BuildQueryArgs = {
  accessFilter: 'all' | 'granted' | 'denied';
  cardFilter: 'all' | string;
  dateRange: DateRange;
  deviceFilter: 'all' | string;
  search: string;
  userFilter: 'all' | string;
};

const buildLogsQuery = ({
  accessFilter,
  cardFilter,
  dateRange,
  deviceFilter,
  search,
  userFilter,
}: BuildQueryArgs) => {
  const query: Record<string, string> = { limit: DEFAULT_LIMIT };

  if (deviceFilter !== 'all') {
    query.deviceId = deviceFilter;
  }
  if (cardFilter !== 'all') {
    query.cardId = cardFilter;
  }
  if (userFilter !== 'all') {
    query.userId = userFilter;
  }
  if (accessFilter === 'granted') {
    query.granted = 'true';
  } else if (accessFilter === 'denied') {
    query.granted = 'false';
  }
  if (dateRange.from) {
    query.from = dateRange.from.toISOString();
  }
  if (dateRange.to) {
    query.to = dateRange.to.toISOString();
  }
  if (search) {
    query.search = search;
  }

  return query;
};

function LogsPage() {
  const { data: session } = authClient.useSession();
  const [search, setSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<'all' | string>('all');
  const [cardFilter, setCardFilter] = useState<'all' | string>('all');
  const [userFilter, setUserFilter] = useState<'all' | string>('all');
  const [accessFilter, setAccessFilter] = useState<
    'all' | 'granted' | 'denied'
  >('all');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: dayjs().subtract(7, 'day').startOf('day').toDate(),
    to: new Date(),
  });

  const deferredSearch = useDeferredValue(search.trim());

  const canReadDevices = useHasPermission(
    'doorlock:devices:read',
    session?.user?.permissions
  );
  const canReadCards = useHasPermission(
    'doorlock:cards:read',
    session?.user?.permissions
  );

  const devicesQuery = useQuery({
    enabled: canReadDevices,
    queryFn: async (): Promise<DoorlockDevice[]> => {
      const res = await parseResponse(apiClient.doorlock.devices.$get());
      if (!(res.success && res.data?.devices)) {
        throw new Error('Failed to load devices');
      }
      return res.data.devices as DoorlockDevice[];
    },
    queryKey: ['doorlock', 'devices'],
  });

  const cardsQuery = useQuery({
    enabled: canReadCards,
    queryFn: async (): Promise<DoorlockCard[]> => {
      const res = await parseResponse(apiClient.doorlock.cards.$get());
      if (!(res.success && res.data?.cards)) {
        throw new Error('Failed to load cards');
      }
      return res.data.cards as DoorlockCard[];
    },
    queryKey: ['doorlock', 'cards'],
  });

  const logsQuery = useQuery({
    queryFn: async (): Promise<DoorlockLogEntry[]> => {
      const query = buildLogsQuery({
        accessFilter,
        cardFilter,
        dateRange,
        deviceFilter,
        search: deferredSearch,
        userFilter,
      });

      const res = await parseResponse(apiClient.doorlock.logs.$get({ query }));
      if (!(res.success && res.data?.logs)) {
        throw new Error('Failed to load logs');
      }
      return res.data.logs as DoorlockLogEntry[];
    },
    queryKey: [
      'doorlock',
      'logs',
      deviceFilter,
      cardFilter,
      userFilter,
      accessFilter,
      dateRange.from?.toISOString() ?? 'none',
      dateRange.to?.toISOString() ?? 'none',
      deferredSearch,
    ],
    staleTime: 30_000,
  });

  const deviceOptions = useOptions(
    devicesQuery.data,
    logsQuery.data?.flatMap((log) =>
      log.device
        ? [{ id: log.device.id, label: log.device.name ?? 'Device' }]
        : []
    ) ?? []
  );

  const cardOptions = useOptions(
    cardsQuery.data,
    logsQuery.data?.flatMap((log) =>
      log.card ? [{ id: log.card.id, label: log.card.name ?? 'Card' }] : []
    ) ?? []
  );

  const userOptions = useMemo<FilterOption[]>(() => {
    const seen = new Map<string, string>();
    for (const log of logsQuery.data ?? []) {
      if (log.owner?.id) {
        seen.set(
          log.owner.id,
          log.owner.nickname || log.owner.name || log.owner.email || 'User'
        );
      }
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [logsQuery.data]);

  const stats = useMemo(() => {
    const logs = logsQuery.data ?? [];
    const total = logs.length;
    const granted = logs.filter((log) => log.result).length;
    const virtualCount = logs.filter(isVirtualLog).length;
    const physicalCount = total - virtualCount;
    const uniqueUsers = new Set(
      logs.map((log) => log.userId ?? log.owner?.id).filter(Boolean)
    ).size;
    return {
      physicalCount,
      successRate: total ? Math.round((granted / total) * 100) : 0,
      total,
      uniqueUsers,
      virtualCount,
    };
  }, [logsQuery.data]);

  const filteredLogs = useMemo(() => {
    const logs = logsQuery.data ?? [];
    if (eventFilter === 'all') {
      return logs;
    }
    return logs.filter((log) =>
      eventFilter === 'virtual' ? isVirtualLog(log) : !isVirtualLog(log)
    );
  }, [eventFilter, logsQuery.data]);

  const hasError = logsQuery.isError;
  const isLoading = logsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          helper={`${stats.virtualCount} virtual • ${stats.physicalCount} physical`}
          icon={<FaDoorOpen className="text-primary" />}
          label="Total attempts"
          value={stats.total}
        />
        <StatCard
          icon={<FaCheck className="text-primary" />}
          label="Success rate"
          value={`${stats.successRate}%`}
        />
        <StatCard
          icon={<FaUser className="text-primary" />}
          label="Unique users"
          value={stats.uniqueUsers}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Input
          className="w-full"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search logs..."
          value={search}
        />
        <SelectFilter
          label="Device"
          onValueChange={setDeviceFilter}
          options={deviceOptions}
          value={deviceFilter}
        />
        <SelectFilter
          label="Card"
          onValueChange={setCardFilter}
          options={cardOptions}
          value={cardFilter}
        />
        <SelectFilter
          label="User"
          onValueChange={setUserFilter}
          options={userOptions}
          value={userFilter}
        />
        <SelectFilter
          label="Access"
          onValueChange={setAccessFilter}
          options={[
            { id: 'all', label: 'All attempts' },
            { id: 'granted', label: 'Access granted' },
            { id: 'denied', label: 'Access denied' },
          ]}
          value={accessFilter}
        />
        <SelectFilter
          label="Event"
          onValueChange={setEventFilter}
          options={[
            { id: 'virtual', label: 'Virtual card' },
            { id: 'physical', label: 'Physical button' },
          ]}
          value={eventFilter}
        />
        <DateRangePicker onChange={setDateRange} value={dateRange} />
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>Unable to load logs</AlertTitle>
          <AlertDescription>
            {(logsQuery.error as Error)?.message ?? 'Please try again later.'}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Card</TableHead>
              <TableHead>Card UID</TableHead>
              <TableHead>Button</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => (
              <LogTableRow key={log.id} log={log} />
            ))}
            {!(filteredLogs.length || hasError) && (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={7}>
                  No logs found with the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function DateRangePicker({
  onChange,
  value,
}: {
  onChange: (range: DateRange) => void;
  value: DateRange;
}) {
  const getRangeLabel = () => {
    if (!value.from) {
      return 'Select dates';
    }
    if (!value.to) {
      return dayjs(value.from).format('MMM DD, YYYY');
    }
    return `${dayjs(value.from).format('MMM DD, YYYY')} - ${dayjs(value.to).format('MMM DD, YYYY')}`;
  };
  const buttonLabel = getRangeLabel();

  return (
    <div className="space-y-2">
      <span className="font-medium text-muted-foreground text-sm">
        Date range
      </span>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              className={cn(
                'w-full justify-start text-left font-normal',
                !value.from && 'text-muted-foreground'
              )}
              variant="outline"
            >
              <FaCalendar className="mr-2 h-4 w-4" />
              <span>{buttonLabel}</span>
            </Button>
          }
        />
        <PopoverPositioner align="end">
          <PopoverContent className="w-auto p-0">
            <Calendar
              initialFocus
              mode="range"
              numberOfMonths={2}
              onSelect={(range) =>
                onChange({ from: range?.from, to: range?.to })
              }
              selected={{ from: value.from, to: value.to }}
            />
          </PopoverContent>
        </PopoverPositioner>
      </Popover>
    </div>
  );
}

type SelectFilterProps<T extends string> = {
  label: string;
  onValueChange: Dispatch<SetStateAction<T>>;
  options: FilterOption[];
  value: T;
};

function SelectFilter<T extends string>({
  label,
  onValueChange,
  options,
  value,
}: SelectFilterProps<T>) {
  return (
    <div className="space-y-2">
      <span className="font-medium text-muted-foreground text-sm">{label}</span>
      <Select onValueChange={(next) => onValueChange(next as T)} value={value}>
        <SelectTrigger>
          <SelectValue placeholder={`Filter by ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectPositioner>
          <SelectContent>
            <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectPositioner>
      </Select>
    </div>
  );
}

type StatCardProps = {
  helper?: string;
  icon: ReactNode;
  label: string;
  value: number | string;
};

function StatCard({ helper, icon, label, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="font-semibold text-3xl">{value}</div>
        {helper && <p className="text-muted-foreground text-xs">{helper}</p>}
      </CardContent>
    </Card>
  );
}

type LogTableRowProps = {
  log: DoorlockLogEntry;
};

function LogTableRow({ log }: LogTableRowProps) {
  const virtual = isVirtualLog(log);
  const buttonMeta = buildButtonMeta(log);

  return (
    <TableRow>
      <TableCell>
        {dayjs(log.timestamp).format('YYYY/MM/DD HH:mm:ss')}
      </TableCell>
      <TableCell>{log.device?.name ?? 'Unknown device'}</TableCell>
      <TableCell>
        {log.owner?.nickname ||
          log.owner?.name ||
          log.owner?.email ||
          'Unknown user'}
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <span>{log.card?.name ?? '—'}</span>
          {virtual && (
            <span className="text-muted-foreground text-xs">
              Self-service virtual activation
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{log.cardData ?? '—'}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <Badge variant={buttonMeta.variant}>{buttonMeta.label}</Badge>
          {buttonMeta.caption && (
            <span className="text-muted-foreground text-xs">
              {buttonMeta.caption}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {log.result ? (
          <span className="text-green-600">Granted</span>
        ) : (
          <span className="text-red-600">Denied</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function useHasPermission(permission: string, permissions?: string[] | null) {
  if (!permissions) {
    return false;
  }
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(permission);
}

function useOptions(
  preferred?: Array<{
    id: string;
    label?: string;
    name?: string;
    nickname?: string;
  }>,
  fallback: FilterOption[] = []
): FilterOption[] {
  if (preferred?.length) {
    return preferred.map((item) => ({
      id: item.id,
      label: item.nickname ?? item.name ?? item.label ?? 'Unknown',
    }));
  }
  const seen = new Map<string, string>();
  for (const option of fallback) {
    if (!seen.has(option.id)) {
      seen.set(option.id, option.label);
    }
  }
  return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
}
