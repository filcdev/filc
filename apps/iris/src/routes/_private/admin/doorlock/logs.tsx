import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import { Calendar } from '@filcdev/ui/components/calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@filcdev/ui/components/popover';
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
import { useIsMobile } from '@filcdev/ui/hooks/use-mobile';
import { cn } from '@filcdev/ui/lib/utils';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
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
import { useTranslation } from 'react-i18next';
import { CardDialog } from '@/components/doorlock/card-dialog';
import { ExportLogsButton } from '@/components/doorlock/export-logs';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type DoorlockCard,
  type DoorlockDevice,
  type DoorlockLogEntry,
  useCardUsers,
  useDoorlockCards,
  useDoorlockDevices,
  useDoorlockLogs,
} from '@/hooks/doorlock-admin';
import { useHasPermission } from '@/hooks/use-has-permission';
import { type UseSortableResult, useSortable } from '@/hooks/use-sortable';
import { orpc, prefetch } from '@/utils/orpc';

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
  // A key, not a label: the same value sorts the column and renders the badge.
  labelKey:
    | 'doorlockLogs.cardSwipe'
    | 'doorlockLogs.physicalButton'
    | 'doorlockLogs.virtualCard';
  variant: 'default' | 'outline' | 'secondary';
};

const buildButtonMeta = (log: DoorlockLogEntry): ButtonMeta => {
  if (isVirtualLog(log)) {
    return {
      labelKey: 'doorlockLogs.virtualCard',
      variant: 'secondary',
    };
  }

  if (log.buttonPressed) {
    return {
      labelKey: 'doorlockLogs.physicalButton',
      variant: 'outline',
    };
  }

  return {
    labelKey: 'doorlockLogs.cardSwipe',
    variant: 'default',
  };
};

export const Route = createFileRoute('/_private/admin/doorlock/logs')({
  component: () => (
    <PermissionGuard permission={permissions.doorlockLogsRead}>
      <LogsPage />
    </PermissionGuard>
  ),
  // The log list itself is filtered by local state (including a "last 7 days"
  // range computed at render time), so only the two pickers it opens with are
  // worth prefetching.
  loader: ({ context }) =>
    Promise.all([
      prefetch(context.queryClient, orpc.doorlock.devices.list.queryOptions()),
      prefetch(context.queryClient, orpc.doorlock.cards.list.queryOptions()),
    ]),
});

type DateRange = {
  from?: Date;
  to?: Date;
};

type FilterOption = {
  id: string;
  label: string;
};

function useLogStats(
  logs: DoorlockLogEntry[] | undefined,
  eventFilter: EventFilter
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

  // Only the filter lives here; the ordering is the hook's job.
  const filtered = useMemo(() => {
    const data = logs ?? [];
    return eventFilter === 'all'
      ? data
      : data.filter((log) =>
          eventFilter === 'virtual' ? isVirtualLog(log) : !isVirtualLog(log)
        );
  }, [eventFilter, logs]);

  const { column, direction, rows, toggle } = useSortable(filtered, {
    getValue: getLogSortValue,
  });

  return { column, direction, rows, stats, toggle };
}

function LogsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [pendingCardData, setPendingCardData] = useState<string | null>(null);

  const hasCardWritePermission = useHasPermission(
    permissions.doorlockCardsWrite,
    session?.user?.permissions
  );

  const canReadDevices = useHasPermission(
    permissions.doorlockDevicesRead,
    session?.user?.permissions
  );
  const canReadCards = useHasPermission(
    permissions.doorlockCardsRead,
    session?.user?.permissions
  );

  const devicesQuery = useDoorlockDevices({ enabled: canReadDevices });
  const devices: DoorlockDevice[] | undefined = devicesQuery.data?.items;

  const cardsQuery = useDoorlockCards({ enabled: canReadCards });
  const cards: DoorlockCard[] | undefined = cardsQuery.data?.items;

  const logsQuery = useDoorlockLogs({
    accessFilter,
    cardFilter,
    dateRange,
    deviceFilter,
    search: deferredSearch,
    userFilter,
  });
  const logs: DoorlockLogEntry[] | undefined = logsQuery.data?.items;

  const usersQuery = useCardUsers({ enabled: hasCardWritePermission });
  const users = usersQuery.data?.items;

  const cardDialogCard = useMemo(() => {
    if (!pendingCardData) {
      return null;
    }
    return {
      authorizedDevices: [] as Array<{ id: string; name: string }>,
      cardData: pendingCardData,
      createdAt: new Date(),
      enabled: true,
      frozen: false,
      id: '',
      name: '',
      owner: null,
      updatedAt: new Date(),
      userId: null,
    } satisfies DoorlockCard;
  }, [pendingCardData]);

  const deviceOptions = useOptions(
    devices,
    logs?.flatMap((log) =>
      log.device
        ? [
            {
              id: log.device.id,
              label: log.device.name ?? t('doorlockLogs.device'),
            },
          ]
        : []
    ) ?? [],
    t('doorlockLogs.unknown')
  );

  const cardOptions = useOptions(
    cards,
    logs?.flatMap((log) =>
      log.card
        ? [{ id: log.card.id, label: log.card.name ?? t('doorlockLogs.card') }]
        : []
    ) ?? [],
    t('doorlockLogs.unknown')
  );

  const userOptions = useMemo<FilterOption[]>(() => {
    const seen = new Map<string, string>();
    for (const log of logs ?? []) {
      if (log.owner?.id) {
        seen.set(
          log.owner.id,
          log.owner.nickname ||
            log.owner.name ||
            log.owner.email ||
            t('doorlockLogs.user')
        );
      }
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [logs, t]);

  const { rows: filteredLogs, stats, ...sort } = useLogStats(logs, eventFilter);

  const hasError = logsQuery.isError;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          helper={t('doorlockLogs.virtualPhysical', {
            physical: stats.physicalCount,
            virtual: stats.virtualCount,
          })}
          icon={<DoorOpen className="text-primary" />}
          label={t('doorlockLogs.totalAttempts')}
          value={stats.total}
        />
        <StatCard
          icon={<Check className="text-primary" />}
          label={t('doorlockLogs.successRate')}
          value={`${stats.successRate}%`}
        />
        <StatCard
          icon={<User className="text-primary" />}
          label={t('doorlockLogs.uniqueUsers')}
          value={stats.uniqueUsers}
        />
      </div>

      <div className="flex items-center gap-2">
        <ExportLogsButton
          accessFilter={accessFilter}
          cardFilter={cardFilter}
          dateRange={dateRange}
          deviceFilter={deviceFilter}
          eventFilter={eventFilter}
          search={deferredSearch}
          userFilter={userFilter}
        />
        {isMobile && (
          <Button
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((prev) => !prev)}
            size="sm"
            variant="outline"
          >
            <Filter className="h-4 w-4" />
            {t('doorlockLogs.filters')}
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
            <Label>{t('doorlockLogs.search')}</Label>
            <Input
              className="w-full"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('doorlockLogs.searchPlaceholder')}
              value={search}
            />
          </div>
          <SelectFilter
            label={t('doorlockLogs.device')}
            onValueChange={setDeviceFilter}
            options={deviceOptions}
            value={deviceFilter}
          />
          <SelectFilter
            label={t('doorlockLogs.card')}
            onValueChange={setCardFilter}
            options={cardOptions}
            value={cardFilter}
          />
          <SelectFilter
            label={t('doorlockLogs.user')}
            onValueChange={setUserFilter}
            options={userOptions}
            value={userFilter}
          />
          <SelectFilter
            label={t('doorlockLogs.access')}
            onValueChange={setAccessFilter}
            options={[
              { id: 'granted', label: t('doorlockLogs.accessGranted') },
              { id: 'denied', label: t('doorlockLogs.accessDenied') },
            ]}
            value={accessFilter}
          />
          <SelectFilter
            label={t('doorlockLogs.event')}
            onValueChange={setEventFilter}
            options={[
              { id: 'virtual', label: t('doorlockLogs.virtualCard') },
              { id: 'physical', label: t('doorlockLogs.physicalButton') },
            ]}
            value={eventFilter}
          />
          <DateRangePicker onChange={setDateRange} value={dateRange} />
        </div>
      )}

      <QueryBoundary data={logsQuery.data} query={logsQuery}>
        {() => (
          <LogsTable
            hasCardWritePermission={hasCardWritePermission}
            hasError={hasError}
            logs={filteredLogs}
            onAddCard={(cardData) => {
              setPendingCardData(cardData);
              setCardDialogOpen(true);
            }}
            sort={sort}
          />
        )}
      </QueryBoundary>

      {hasCardWritePermission && (
        <CardDialog
          card={cardDialogCard}
          context="logs"
          devices={devices ?? []}
          key={`${cardDialogOpen ? 'open' : 'closed'}:${cardDialogCard?.cardData ?? 'new'}`}
          onOpenChange={setCardDialogOpen}
          open={cardDialogOpen}
          users={
            (users ?? []) as Array<{
              id: string;
              name: string | null;
              nickname: string | null;
              email: string | null;
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
  const { t } = useTranslation();
  const getRangeLabel = () => {
    if (!value.from) {
      return t('doorlockLogs.selectDates');
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
        {t('doorlockLogs.dateRange')}
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
  const { t } = useTranslation();
  const handleChange = (next: string | null) =>
    onValueChange((next ?? 'all') as T);
  const items = [
    {
      label: t('doorlockLogs.allOption', { label: label.toLowerCase() }),
      value: 'all',
    },
    ...options.map((option) => ({ label: option.label, value: option.id })),
  ];
  return (
    <div className="grow space-y-2">
      <Label>{label}</Label>
      <Select items={items} onValueChange={handleChange} value={value}>
        <SelectTrigger className="w-full min-w-24">
          <SelectValue
            data-placeholder={t('doorlockLogs.filterBy', {
              label: label.toLowerCase(),
            })}
          />
        </SelectTrigger>
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

// The list renders up to 500 rows in one pass; `content-visibility` on the row
// keeps the offscreen ones out of layout and paint without a virtualizer.
function LogTableRow({ log, onAddCard }: LogTableRowProps) {
  const { t } = useTranslation();
  const buttonMeta = buildButtonMeta(log);

  return (
    <TableRow className="[contain-intrinsic-size:auto_44px] [content-visibility:auto]">
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
          <Badge variant={buttonMeta.variant}>{t(buttonMeta.labelKey)}</Badge>
        </div>
      </TableCell>
      <TableCell>
        {log.result ? (
          <span className="text-green-600 dark:text-green-400">
            {t('doorlockLogs.granted')}
          </span>
        ) : (
          <span className="text-red-600 dark:text-red-400">
            {t('doorlockLogs.denied')}
          </span>
        )}
      </TableCell>
      <TableCell>
        {onAddCard && (
          <Button
            aria-label={t('doorlockLogs.addCard')}
            disabled={!log.cardData}
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

type LogsTableProps = {
  hasCardWritePermission: boolean;
  hasError: boolean;
  logs: DoorlockLogEntry[];
  onAddCard: (cardData: string | null) => void;
  sort: Pick<
    UseSortableResult<DoorlockLogEntry, LogSortColumn>,
    'column' | 'direction' | 'toggle'
  >;
};

function LogsTable({
  hasCardWritePermission,
  hasError,
  logs,
  onAddCard,
  sort,
}: LogsTableProps) {
  const { t } = useTranslation();
  const { direction, toggle } = sort;

  const header = (column: LogSortColumn, label: string) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => toggle(column)}
    >
      <div className="flex items-center gap-2">
        {label}
        <SortIcon
          column={column}
          currentColumn={column}
          direction={direction}
        />
      </div>
    </TableHead>
  );

  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full min-w-3xl">
        <TableHeader>
          <TableRow>
            {header('timestamp', t('doorlockLogs.timestamp'))}
            {header('device', t('doorlockLogs.device'))}
            {header('user', t('doorlockLogs.user'))}
            {header('card', t('doorlockLogs.card'))}
            {header('cardData', t('doorlockLogs.cardUid'))}
            {header('triggeredBy', t('doorlockLogs.triggeredBy'))}
            {header('result', t('doorlockLogs.result'))}
            <TableHead>{/* Actions */}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <LogTableRow
              key={log.id}
              log={log}
              onAddCard={hasCardWritePermission ? onAddCard : undefined}
            />
          ))}
          {!(logs.length || hasError) && (
            <TableRow>
              <TableCell className="text-muted-foreground" colSpan={8}>
                {t('doorlockLogs.noLogsFound')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function useOptions(
  preferred:
    | Array<{
        id: string;
        label?: string;
        name?: string;
        nickname?: string;
      }>
    | undefined,
  fallback: FilterOption[],
  unknownLabel: string
): FilterOption[] {
  if (preferred?.length) {
    return preferred.map((item) => ({
      id: item.id,
      label: item.nickname ?? item.name ?? item.label ?? unknownLabel,
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
      return buildButtonMeta(log).labelKey;
    case 'result':
      return log.result ? 1 : 0;
    default:
      return '';
  }
}
