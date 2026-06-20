import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  CreditCard,
  DoorOpen,
  Filter,
  User,
} from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useDeferredValue, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CardDialog } from '@/components/doorlock/card-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionGuard } from '@/components/util/permission-guard';
import { SortIcon } from '@/components/util/sort-icon';
import { useHasPermission } from '@/hooks/use-has-permission';
import { useIsMobile } from '@/hooks/use-mobile';
import { authClient } from '@/utils/authentication';
import { api } from '@/utils/hc';
import { cn } from '@/utils/index';
import { queryKeys } from '@/utils/query-keys';

type DevicesResponse = InferResponseType<typeof api.doorlock.devices.$get>;
type CardsResponse = InferResponseType<typeof api.doorlock.cards.$get>;
type LogsResponse = InferResponseType<typeof api.doorlock.logs.$get>;

type DoorlockDevice = NonNullable<DevicesResponse['data']>['devices'][number];
type DoorlockCard = NonNullable<CardsResponse['data']>['cards'][number];
type DoorlockLogEntry = NonNullable<LogsResponse['data']>['logs'][number];

type EventFilter = 'all' | 'virtual' | 'physical';
type LogSortColumn =
  | 'timestamp'
  | 'device'
  | 'user'
  | 'card'
  | 'cardData'
  | 'triggeredBy'
  | 'result';

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

export const Route = createFileRoute('/_private/admin/doorlock/logs')({
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

function useLogStats(
  logs: DoorlockLogEntry[] | undefined,
  eventFilter: EventFilter,
  sortColumn: LogSortColumn | null,
  sortDirection: 'asc' | 'desc' | null
) {
  const stats = useMemo(() => {
    const data = logs ?? [];
    const total = data.length;
    const granted = data.filter((log) => log.result).length;
    const virtualCount = data.filter(isVirtualLog).length;
    const physicalCount = total - virtualCount;
    const uniqueUsers = new Set(
      data.map((log) => log.userId ?? log.owner?.id).filter(Boolean)
    ).size;
    return {
      physicalCount,
      successRate: total ? Math.round((granted / total) * 100) : 0,
      total,
      uniqueUsers,
      virtualCount,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const data = logs ?? [];
    let filtered =
      eventFilter === 'all'
        ? data
        : data.filter((log) =>
            eventFilter === 'virtual' ? isVirtualLog(log) : !isVirtualLog(log)
          );

    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = getLogSortValue(a, sortColumn);
        const bValue = getLogSortValue(b, sortColumn);

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [eventFilter, logs, sortColumn, sortDirection]);

  return { filteredLogs, stats };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: filter state and queries
function LogsPage() {
  const { data: session } = authClient.useSession();
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<LogSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );
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

  const queryClient = useQueryClient();
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [pendingCardData, setPendingCardData] = useState<string | null>(null);

  const hasCardWritePermission = useHasPermission(
    'doorlock:cards:write',
    session?.user?.permissions
  );

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
      const res = await parseResponse(api.doorlock.devices.$get());
      if (!(res.success && res.data?.devices)) {
        throw new Error('Failed to load devices');
      }
      return res.data.devices as DoorlockDevice[];
    },
    queryKey: queryKeys.doorlock.devices(),
  });

  const cardsQuery = useQuery({
    enabled: canReadCards,
    queryFn: async (): Promise<DoorlockCard[]> => {
      const res = await parseResponse(api.doorlock.cards.$get());
      if (!(res.success && res.data?.cards)) {
        throw new Error('Failed to load cards');
      }
      return res.data.cards as DoorlockCard[];
    },
    queryKey: queryKeys.doorlock.cards(),
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

      const res = await parseResponse(api.doorlock.logs.$get({ query }));
      if (!(res.success && res.data?.logs)) {
        throw new Error('Failed to load logs');
      }
      return res.data.logs as DoorlockLogEntry[];
    },
    queryKey: queryKeys.doorlock.logs(
      deviceFilter,
      cardFilter,
      userFilter,
      accessFilter,
      dateRange.from?.toISOString() ?? 'none',
      dateRange.to?.toISOString() ?? 'none',
      deferredSearch
    ),
    staleTime: 30_000,
  });

  const usersQuery = useQuery({
    enabled: hasCardWritePermission,
    queryFn: async () => {
      const res = await parseResponse(api.doorlock.cards.users.$get());
      if (!(res.success && res.data?.users)) {
        throw new Error('Failed to load users');
      }
      return res.data.users;
    },
    queryKey: queryKeys.doorlock.cardUsers(),
  });

  const $upsertCard = api.doorlock.cards.$post;
  const upsertCardMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id?: string;
      payload: InferRequestType<typeof $upsertCard>['json'];
    }) => {
      if (id) {
        return parseResponse(
          api.doorlock.cards[':id'].$put({ json: payload, param: { id } })
        );
      }
      return parseResponse(api.doorlock.cards.$post({ json: payload }));
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save card');
    },
    onSuccess: () => {
      toast.success('Card saved');
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.cards() });
      queryClient.invalidateQueries({ queryKey: queryKeys.doorlock.stats() });
      setCardDialogOpen(false);
    },
  });

  const cardDialogCard = useMemo(() => {
    if (!pendingCardData) {
      return null;
    }
    return {
      authorizedDevices: [] as Array<{ id: string; name: string }>,
      cardData: pendingCardData,
      createdAt: '',
      enabled: true,
      frozen: false,
      id: '',
      name: '',
      owner: null,
      updatedAt: '',
      userId: null,
    } satisfies DoorlockCard;
  }, [pendingCardData]);

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

  const { filteredLogs, stats } = useLogStats(
    logsQuery.data,
    eventFilter,
    sortColumn,
    sortDirection
  );

  const handleSort = (column: LogSortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
      return;
    }

    setSortColumn(column);
    setSortDirection('asc');
  };

  const hasError = logsQuery.isError;
  const isLoading = logsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          helper={`${stats.virtualCount} virtual • ${stats.physicalCount} physical`}
          icon={<DoorOpen className="text-primary" />}
          label="Total attempts"
          value={stats.total}
        />
        <StatCard
          icon={<Check className="text-primary" />}
          label="Success rate"
          value={`${stats.successRate}%`}
        />
        <StatCard
          icon={<User className="text-primary" />}
          label="Unique users"
          value={stats.uniqueUsers}
        />
      </div>

      <div className="flex items-center gap-2">
        {isMobile && (
          <Button
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((prev) => !prev)}
            size="sm"
            variant="outline"
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                filtersOpen && 'rotate-180'
              )}
            />
          </Button>
        )}
      </div>

      {(!isMobile || filtersOpen) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:flex xl:flex-wrap xl:items-end xl:gap-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input
              className="w-full"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search logs..."
              value={search}
            />
          </div>
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
      )}

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
        <div className="w-full overflow-x-auto rounded-md border">
          <Table className="w-full min-w-3xl">
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('timestamp')}
                >
                  <div className="flex items-center gap-2">
                    Timestamp
                    <SortIcon
                      column="timestamp"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('device')}
                >
                  <div className="flex items-center gap-2">
                    Device
                    <SortIcon
                      column="device"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('user')}
                >
                  <div className="flex items-center gap-2">
                    User
                    <SortIcon
                      column="user"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('card')}
                >
                  <div className="flex items-center gap-2">
                    Card
                    <SortIcon
                      column="card"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('cardData')}
                >
                  <div className="flex items-center gap-2">
                    Card UID
                    <SortIcon
                      column="cardData"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('triggeredBy')}
                >
                  <div className="flex items-center gap-2">
                    Triggered by
                    <SortIcon
                      column="triggeredBy"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:bg-muted/50"
                  onClick={() => handleSort('result')}
                >
                  <div className="flex items-center gap-2">
                    Result
                    <SortIcon
                      column="result"
                      currentColumn={sortColumn}
                      direction={sortDirection}
                    />
                  </div>
                </TableHead>
                <TableHead>{/* Actions */}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <LogTableRow
                  key={log.id}
                  log={log}
                  onAddCard={
                    hasCardWritePermission
                      ? (cardData) => {
                          setPendingCardData(cardData);
                          setCardDialogOpen(true);
                        }
                      : undefined
                  }
                />
              ))}
              {!(filteredLogs.length || hasError) && (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={8}>
                    No logs found with the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {hasCardWritePermission && (
        <CardDialog
          card={cardDialogCard}
          devices={devicesQuery.data ?? []}
          onOpenChange={setCardDialogOpen}
          onSubmit={async (payload) => {
            await upsertCardMutation.mutateAsync({ payload });
          }}
          open={cardDialogOpen}
          users={
            (usersQuery.data ?? []) as Array<{
              id: string;
              name: string | null;
              nickname: string | null;
              email: string;
            }>
          }
        />
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
              <CalendarIcon />
              <span>{buttonLabel}</span>
            </Button>
          }
        />
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            autoFocus
            mode="range"
            numberOfMonths={2}
            onSelect={(range) =>
              onChange({
                ...(range?.from && { from: range.from }),
                ...(range?.to && { to: range.to }),
              })
            }
            selected={{ from: value.from, to: value.to }}
          />
        </PopoverContent>
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
  const handleChange = (next: string | null) =>
    onValueChange((next ?? 'all') as T);
  const selectedLabel =
    options.find((option) => option.id === value)?.label ??
    (value === 'all' ? 'All' : undefined);
  return (
    <div className="grow space-y-2">
      <Label>{label}</Label>
      <Select onValueChange={handleChange} value={value}>
        <SelectTrigger className="w-full min-w-24">
          <SelectValue data-placeholder={`Filter by ${label.toLowerCase()}`}>
            {selectedLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
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
      <CardHeader className="flex items-center justify-between space-y-0 pb-2">
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
  onAddCard?: (cardData: string | null) => void;
};

function LogTableRow({ log, onAddCard }: LogTableRowProps) {
  const buttonMeta = buildButtonMeta(log);

  return (
    <TableRow>
      <TableCell>
        {dayjs(log.timestamp).format('YYYY/MM/DD HH:mm:ss')}
      </TableCell>
      <TableCell>{log.device?.name ?? '—'}</TableCell>
      <TableCell>
        {log.owner?.nickname || log.owner?.name || log.owner?.email || '—'}
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <span>{log.card?.name ?? '—'}</span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{log.cardData ?? '—'}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <Badge variant={buttonMeta.variant}>{buttonMeta.label}</Badge>
        </div>
      </TableCell>
      <TableCell>
        {log.result ? (
          <span className="text-green-600">Granted</span>
        ) : (
          <span className="text-red-600">Denied</span>
        )}
      </TableCell>
      <TableCell>
        {onAddCard && (
          <Button
            aria-label="Add card"
            onClick={() => onAddCard(log.cardData ?? null)}
            size="icon"
            variant="ghost"
          >
            <CreditCard className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
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

function getLogSortValue(log: DoorlockLogEntry, column: LogSortColumn) {
  switch (column) {
    case 'timestamp':
      return new Date(log.timestamp).getTime();
    case 'device':
      return log.device?.name ?? '';
    case 'user':
      return log.owner?.nickname || log.owner?.name || log.owner?.email || '';
    case 'card':
      return log.card?.name ?? '';
    case 'cardData':
      return log.cardData ?? '';
    case 'triggeredBy':
      return buildButtonMeta(log).label;
    case 'result':
      return log.result ? 1 : 0;
    default:
      return '';
  }
}
