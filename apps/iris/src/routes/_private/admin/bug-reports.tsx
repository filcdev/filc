import { permissions } from '@filcdev/api/permissions';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/date-range-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortIcon } from '@/components/util/sort-icon';
import {
  type BugReportItem,
  type BugReportStatus,
  bugReportStatuses,
  useBugReports,
  useDeleteBugReport,
  useUpdateBugReportStatus,
} from '@/hooks/bug-reports';
import { useHasPermission } from '@/hooks/use-has-permission';
import { authClient } from '@/utils/authentication';

export const Route = createFileRoute('/_private/admin/bug-reports')({
  component: AdminBugReportsPage,
});

const PAGE_SIZE = 20;

type SortColumn = 'subject' | 'reporter' | 'page' | 'date' | 'status';

const STATUS_LABEL_KEYS: Record<BugReportStatus, string> = {
  closed: 'closed',
  in_progress: 'inProgress',
  open: 'open',
  resolved: 'resolved',
};

const STATUS_BADGE_VARIANTS: Record<
  BugReportStatus,
  'default' | 'destructive' | 'outline' | 'secondary'
> = {
  closed: 'destructive',
  in_progress: 'secondary',
  open: 'default',
  resolved: 'outline',
};

function formatDate(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

function getSortValue(
  item: BugReportItem,
  column: SortColumn
): string | number {
  switch (column) {
    case 'subject':
      return item.subject;
    case 'reporter':
      return item.reporterEmail ?? '';
    case 'page':
      return item.page ?? '';
    case 'date':
      return new Date(item.createdAt).getTime();
    case 'status':
      return item.status;
    default:
      return '';
  }
}

function AdminBugReportsPage() {
  const { t } = useTranslation();
  const { data: session } = authClient.useSession();
  const hasWritePermission = useHasPermission(
    permissions.bugReportsWrite,
    session?.user?.permissions
  );

  const [statusFilter, setStatusFilter] = useState<'all' | BugReportStatus>(
    'all'
  );
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const [page, setPage] = useState(1);

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    null
  );

  const [selected, setSelected] = useState<BugReportItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const deferredSearch = useDeferredValue(search.trim());

  const reportsQuery = useBugReports({
    dateFrom: dateRange.from ? dateRange.from.toISOString() : '',
    dateTo: dateRange.to ? dateRange.to.toISOString() : '',
    page,
    search: deferredSearch,
    status: statusFilter,
  });

  const updateStatus = useUpdateBugReportStatus();
  const deleteReport = useDeleteBugReport({
    onSaved: () => {
      setDeleteConfirmOpen(false);
      setIsDialogOpen(false);
      setSelected(null);
    },
  });

  const reports = reportsQuery.data?.reports ?? [];
  const total = reportsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const sortedReports = useMemo(() => {
    if (!(sortColumn && sortDirection)) {
      return reports;
    }
    return [...reports].sort((a, b) => {
      const aVal = getSortValue(a, sortColumn);
      const bVal = getSortValue(b, sortColumn);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [reports, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const statusItems = [
    { label: t('bugReports.all'), value: 'all' },
    ...bugReportStatuses.map((status) => ({
      label: t(`bugReports.${STATUS_LABEL_KEYS[status]}`),
      value: status,
    })),
  ];

  const openDetails = (report: BugReportItem) => {
    setSelected(report);
    setIsDialogOpen(true);
  };

  const isLoading = reportsQuery.isLoading;
  const hasError = reportsQuery.isError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">
          {t('bugReports.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('bugReports.listDescription')}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{t('bugReports.status')}</Label>
          <Select
            items={statusItems}
            onValueChange={(value) =>
              setStatusFilter((value ?? 'all') as 'all' | BugReportStatus)
            }
            value={statusFilter}
          >
            <SelectTrigger className="min-w-32">
              <SelectValue data-placeholder={t('bugReports.all')} />
            </SelectTrigger>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('bugReports.searchPlaceholder')}</Label>
          <Input
            className="w-full sm:w-64"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('bugReports.searchPlaceholder')}
            value={search}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('bugReports.dateFilter')}</Label>
          <DateRangePicker onChange={setDateRange} value={dateRange} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => reportsQuery.refetch()} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('bugReports.refresh')}
          </Button>
        </div>
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>{t('bugReports.loadError')}</AlertTitle>
          <AlertDescription>
            {(reportsQuery.error as Error)?.message ??
              t('bugReports.loadErrorMessage')}
          </AlertDescription>
        </Alert>
      )}

      {isLoading && <Skeleton className="h-64 w-full" />}
      {!isLoading && reports.length === 0 && (
        <Alert>
          <AlertTitle>{t('bugReports.noReports')}</AlertTitle>
        </Alert>
      )}
      {!isLoading && reports.length > 0 && (
        <>
          <div className="w-full overflow-x-auto rounded-md border">
            <Table className="w-full min-w-3xl">
              <TableHeader>
                <TableRow>
                  <SortableHeader
                    column="subject"
                    label={t('bugReports.subject')}
                    onSort={handleSort}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                  />
                  <SortableHeader
                    column="reporter"
                    label={t('bugReports.reporter')}
                    onSort={handleSort}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                  />
                  <SortableHeader
                    column="page"
                    label={t('bugReports.page')}
                    onSort={handleSort}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                  />
                  <SortableHeader
                    column="date"
                    label={t('bugReports.date')}
                    onSort={handleSort}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                  />
                  <SortableHeader
                    column="status"
                    label={t('bugReports.status')}
                    onSort={handleSort}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                  />
                  <TableHead>{t('bugReports.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {report.subject}
                    </TableCell>
                    <TableCell>
                      {report.reporterEmail ?? t('bugReports.anonymous')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {report.page ?? '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(report.createdAt)}
                    </TableCell>
                    <TableCell>
                      {hasWritePermission ? (
                        <StatusSelect
                          current={report.status}
                          onSelect={(next) =>
                            updateStatus.mutate({
                              id: report.id,
                              status: next,
                            })
                          }
                        />
                      ) : (
                        <StatusBadge status={report.status} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => openDetails(report)}
                        size="sm"
                        variant="outline"
                      >
                        {t('bugReports.details')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              {t('bugReports.currentPage')} {page} / {totalPages}
            </div>
            <div className="space-x-2">
              <Button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                size="sm"
                variant="outline"
              >
                {t('common.previous')}
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                size="sm"
                variant="outline"
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <Dialog
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setSelected(null);
            }
          }}
          open={isDialogOpen}
        >
          <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-2">
            <div className="flex-1 overflow-y-auto p-6">
              <DialogHeader>
                <DialogTitle>{selected.subject}</DialogTitle>
              </DialogHeader>

              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('bugReports.reporter')}
                  </dt>
                  <dd>{selected.reporterEmail ?? t('bugReports.anonymous')}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('bugReports.page')}
                  </dt>
                  <dd>{selected.page ?? '-'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('bugReports.date')}
                  </dt>
                  <dd>{formatDate(selected.createdAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('bugReports.status')}
                  </dt>
                  <dd>
                    {hasWritePermission ? (
                      <StatusSelect
                        current={selected.status}
                        onSelect={(next) =>
                          updateStatus.mutate({
                            id: selected.id,
                            status: next,
                          })
                        }
                      />
                    ) : (
                      <StatusBadge status={selected.status} />
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('bugReports.description')}
                  </dt>
                  <dd className="whitespace-pre-wrap break-words">
                    {selected.description}
                  </dd>
                </div>
              </dl>
            </div>

            <DialogFooter className="border-t p-4">
              {hasWritePermission && (
                <Button
                  onClick={() => setDeleteConfirmOpen(true)}
                  variant="destructive"
                >
                  {t('common.delete')}
                </Button>
              )}
              <Button
                onClick={() => {
                  setIsDialogOpen(false);
                  setSelected(null);
                }}
                variant="outline"
              >
                {t('bugReports.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog onOpenChange={setDeleteConfirmOpen} open={deleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('bugReports.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('bugReports.deleteDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setDeleteConfirmOpen(false)}
              variant="outline"
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={deleteReport.isPending}
              onClick={() => {
                if (selected) {
                  deleteReport.mutate(selected.id);
                }
              }}
              variant="destructive"
            >
              {deleteReport.isPending
                ? t('common.deleting')
                : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SortableHeaderProps = {
  column: SortColumn;
  label: string;
  onSort: (column: SortColumn) => void;
  sortColumn: SortColumn | null;
  sortDirection: 'asc' | 'desc' | null;
};

function SortableHeader({
  column,
  label,
  onSort,
  sortColumn,
  sortDirection,
}: SortableHeaderProps) {
  return (
    <TableHead className="select-none">
      <button
        className="flex w-full cursor-pointer items-center gap-2 hover:text-foreground"
        onClick={() => onSort(column)}
        type="button"
      >
        {label}
        <SortIcon
          column={column}
          currentColumn={sortColumn}
          direction={sortDirection}
        />
      </button>
    </TableHead>
  );
}

function StatusBadge({ status }: { status: BugReportStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant={STATUS_BADGE_VARIANTS[status]}>
      {t(`bugReports.${STATUS_LABEL_KEYS[status]}`)}
    </Badge>
  );
}

function StatusSelect({
  current,
  onSelect,
}: {
  current: BugReportStatus;
  onSelect: (status: BugReportStatus) => void;
}) {
  const { t } = useTranslation();
  return (
    <Select
      items={bugReportStatuses.map((status) => ({
        label: t(`bugReports.${STATUS_LABEL_KEYS[status]}`),
        value: status,
      }))}
      onValueChange={(value) => {
        if (value) {
          onSelect(value as BugReportStatus);
        }
      }}
      value={current}
    >
      <SelectTrigger className="min-w-28" size="sm">
        <SelectValue />
      </SelectTrigger>
    </Select>
  );
}
