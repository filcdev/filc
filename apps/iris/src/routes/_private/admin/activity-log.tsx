import { permissions } from '@filcdev/api/permissions';
import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
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
import { cn } from '@filcdev/ui/lib/utils';
import { createFileRoute } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';
import { useDeferredValue, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/util/permission-guard';
import { QueryBoundary } from '@/components/util/query-boundary';
import type { ActivityLogEntry } from '@/hooks/activity-log';
import { useActivityLog } from '@/hooks/activity-log';
import { orpc, prefetch } from '@/utils/orpc';

const PAGE_SIZE = 50;

const ACTION_OPTIONS = ['create', 'update', 'delete', 'import'] as const;

export const Route = createFileRoute('/_private/admin/activity-log')({
  component: () => (
    <PermissionGuard permission={permissions.activityLogRead}>
      <ActivityLogPage />
    </PermissionGuard>
  ),
  // Prefetch the first server-filtered page; local filter changes re-query.
  loader: ({ context }) =>
    prefetch(
      context.queryClient,
      orpc.activityLog.list.queryOptions({ input: { limit: 50, offset: 0 } })
    ),
});

function ActivityLogPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('all');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);

  const deferredSearch = useDeferredValue(search.trim());
  const query = useActivityLog({
    ...(action !== 'all' && { action }),
    ...(entityType.trim() && { entityType: entityType.trim() }),
    ...(from && { from: dayjs(from).startOf('day').toDate() }),
    ...(to && { to: dayjs(to).endOf('day').toDate() }),
    ...(deferredSearch && { search: deferredSearch }),
    limit: PAGE_SIZE,
    offset,
  });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const searchId = useId();
  const entityTypeId = useId();
  const fromId = useId();
  const toId = useId();

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor={searchId}>{t('activityLog.search')}</Label>
          <Input
            aria-label={t('activityLog.searchAria')}
            id={searchId}
            onChange={(event) => {
              setOffset(0);
              setSearch(event.target.value);
            }}
            placeholder={t('activityLog.searchPlaceholder')}
            value={search}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('activityLog.action')}</Label>
          <Select
            items={[
              { label: t('activityLog.actionAll'), value: 'all' },
              ...ACTION_OPTIONS.map((value) => ({
                label: t(`activityLog.action_${value}`),
                value,
              })),
            ]}
            onValueChange={(next) => {
              setOffset(0);
              setAction(next ?? 'all');
            }}
            value={action}
          >
            <SelectTrigger
              aria-label={t('activityLog.actionAria')}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={entityTypeId}>{t('activityLog.entityType')}</Label>
          <Input
            aria-label={t('activityLog.entityTypeAria')}
            id={entityTypeId}
            onChange={(event) => {
              setOffset(0);
              setEntityType(event.target.value);
            }}
            placeholder={t('activityLog.entityTypePlaceholder')}
            value={entityType}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={fromId}>{t('activityLog.dateFrom')}</Label>
          <Input
            aria-label={t('activityLog.dateFromAria')}
            id={fromId}
            max={to || undefined}
            onChange={(event) => {
              setOffset(0);
              setFrom(event.target.value);
            }}
            type="date"
            value={from}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={toId}>{t('activityLog.dateTo')}</Label>
          <Input
            aria-label={t('activityLog.dateToAria')}
            id={toId}
            min={from || undefined}
            onChange={(event) => {
              setOffset(0);
              setTo(event.target.value);
            }}
            type="date"
            value={to}
          />
        </div>
      </div>

      <QueryBoundary data={query.data} query={query}>
        {() => (
          <>
            <div className="w-full overflow-x-auto rounded-md border">
              <Table className="w-full min-w-3xl">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('activityLog.createdAt')}</TableHead>
                    <TableHead>{t('activityLog.actor')}</TableHead>
                    <TableHead>{t('activityLog.action')}</TableHead>
                    <TableHead>{t('activityLog.entityType')}</TableHead>
                    <TableHead>{t('activityLog.entityId')}</TableHead>
                    <TableHead>{t('activityLog.metadata')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <ActivityLogRow entry={item} key={item.id} />
                  ))}
                  {!items.length && (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={6}>
                        {t('activityLog.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button
                aria-label={t('activityLog.prevPageAria')}
                disabled={page <= 1}
                onClick={() => setOffset(offset - PAGE_SIZE)}
                size="icon"
                variant="outline"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground text-sm">
                {t('activityLog.pageInfo', { page, pageCount, total })}
              </span>
              <Button
                aria-label={t('activityLog.nextPageAria')}
                disabled={page >= pageCount}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                size="icon"
                variant="outline"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function ActivityLogRow({ entry }: { entry: ActivityLogEntry }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = entry.metadata != null;

  return (
    <>
      <TableRow>
        <TableCell>{dayjs(entry.createdAt).format('L LTS')}</TableCell>
        <TableCell>
          {entry.actor?.nickname ||
            entry.actor?.name ||
            entry.actor?.email ||
            '—'}
        </TableCell>
        <TableCell>{entry.action}</TableCell>
        <TableCell>{entry.entityType}</TableCell>
        <TableCell className="font-mono text-xs">
          {entry.entityId ?? '—'}
        </TableCell>
        <TableCell>
          {hasMetadata && (
            <Button
              aria-expanded={expanded}
              aria-label={t('activityLog.metadataToggleAria')}
              onClick={() => setExpanded((prev) => !prev)}
              size="sm"
              variant="ghost"
            >
              {expanded ? <ChevronUp /> : <ChevronDown />}
              {t('activityLog.details')}
            </Button>
          )}
          {!hasMetadata && <span className="text-muted-foreground">—</span>}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6}>
            <pre
              className={cn(
                'max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs'
              )}
            >
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
