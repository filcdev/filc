import { permissions } from '@filcdev/api/permissions';
import { useSession } from '@filcdev/auth/client';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@filcdev/ui/components/alert';
import { Badge } from '@filcdev/ui/components/badge';
import { Button } from '@filcdev/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@filcdev/ui/components/dialog';
import { Input } from '@filcdev/ui/components/input';
import { Label } from '@filcdev/ui/components/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
} from '@filcdev/ui/components/select';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@filcdev/ui/components/table';
import { createFileRoute } from '@tanstack/react-router';
import { RefreshCw } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/date-range-picker';
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
import { useSortable } from '@/hooks/use-sortable';
import { formatLocalizedDate } from '@/utils/date-locale';
import { orpc, prefetch } from '@/utils/orpc';

export const Route = createFileRoute('/_private/admin/bug-reports')({
  component: AdminBugReportsPage,
  // The table's own filters are local state, so only the unfiltered first page
  // can be prefetched; a narrowed list is fetched by the browser.
  loader: ({ context }) =>
    prefetch(
      context.queryClient,
      orpc.bugReport.list.queryOptions({ input: { limit: 20, page: 1 } })
    ),
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

function formatDate(value: string | Date, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return formatLocalizedDate(date, language, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Budapest',
  });
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
  const { data: session } = useSession();
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

  const reports = reportsQuery.data?.items ?? [];
  const total = reportsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const {
    column: sortColumn,
    direction: sortDirection,
    rows: sortedReports,
    toggle: handleSort,
  } = useSortable(reports, { getValue: getSortValue });

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
        <BugReportsTable
          hasWritePermission={hasWritePermission}
          onOpenDetails={openDetails}
          onPageChange={setPage}
          onSort={handleSort}
          onStatusChange={(report, status) =>
            updateStatus.mutate({ id: report.id, status })
          }
          page={page}
          reports={sortedReports}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          totalPages={totalPages}
        />
      )}

      {selected && (
        <BugReportDetailsDialog
          hasWritePermission={hasWritePermission}
          onDeleteRequest={() => setDeleteConfirmOpen(true)}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setSelected(null);
            }
          }}
          onStatusChange={(report, status) =>
            updateStatus.mutate({ id: report.id, status })
          }
          open={isDialogOpen}
          report={selected}
        />
      )}

      <BugReportDeleteDialog
        isPending={deleteReport.isPending}
        onConfirm={() => {
          if (selected) {
            deleteReport.mutate({ id: selected.id });
          }
        }}
        onOpenChange={setDeleteConfirmOpen}
        open={deleteConfirmOpen}
      />
    </div>
  );
}

/** The report detail dialog, opened from a row's Details button. */
function BugReportDetailsDialog({
  hasWritePermission,
  onDeleteRequest,
  onOpenChange,
  onStatusChange,
  open,
  report,
}: {
  hasWritePermission: boolean;
  onDeleteRequest: () => void;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (report: BugReportItem, status: BugReportStatus) => void;
  open: boolean;
  report: BugReportItem;
}) {
  const { i18n, t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col p-2">
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>{report.subject}</DialogTitle>
          </DialogHeader>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">
                {t('bugReports.reporter')}
              </dt>
              <dd>{report.reporterEmail ?? t('bugReports.anonymous')}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                {t('bugReports.page')}
              </dt>
              <dd>{report.page ?? '-'}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                {t('bugReports.date')}
              </dt>
              <dd>{formatDate(report.createdAt, i18n.language)}</dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                {t('bugReports.status')}
              </dt>
              <dd>
                {hasWritePermission ? (
                  <StatusSelect
                    current={report.status}
                    onSelect={(next) => onStatusChange(report, next)}
                  />
                ) : (
                  <StatusBadge status={report.status} />
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                {t('bugReports.description')}
              </dt>
              <dd className="wrap-break-word whitespace-pre-wrap">
                {report.description}
              </dd>
            </div>
          </dl>
        </div>

        <DialogFooter className="border-t p-4">
          {hasWritePermission && (
            <Button onClick={onDeleteRequest} variant="destructive">
              {t('common.delete')}
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {t('bugReports.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmation dialog for deleting the selected report. */
function BugReportDeleteDialog({
  isPending,
  onConfirm,
  onOpenChange,
  open,
}: {
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('bugReports.deleteConfirm')}</DialogTitle>
          <DialogDescription>
            {t('bugReports.deleteDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {t('common.cancel')}
          </Button>
          <Button
            disabled={isPending}
            onClick={onConfirm}
            variant="destructive"
          >
            {isPending ? t('common.deleting') : t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type BugReportsTableProps = {
  hasWritePermission: boolean;
  onOpenDetails: (report: BugReportItem) => void;
  onPageChange: (page: number) => void;
  onSort: (column: SortColumn) => void;
  onStatusChange: (report: BugReportItem, status: BugReportStatus) => void;
  page: number;
  reports: BugReportItem[];
  sortColumn: SortColumn | null;
  sortDirection: 'asc' | 'desc' | null;
  totalPages: number;
};

/** The reports table and its pager; the page renders it only when there are rows. */
function BugReportsTable({
  hasWritePermission,
  onOpenDetails,
  onPageChange,
  onSort,
  onStatusChange,
  page,
  reports,
  sortColumn,
  sortDirection,
  totalPages,
}: BugReportsTableProps) {
  const { i18n, t } = useTranslation();

  return (
    <>
      <div className="w-full overflow-x-auto rounded-md border">
        <Table className="w-full min-w-3xl">
          <TableHeader>
            <TableRow>
              <SortableHeader
                column="subject"
                label={t('bugReports.subject')}
                onSort={onSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
              />
              <SortableHeader
                column="reporter"
                label={t('bugReports.reporter')}
                onSort={onSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
              />
              <SortableHeader
                column="page"
                label={t('bugReports.page')}
                onSort={onSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
              />
              <SortableHeader
                column="date"
                label={t('bugReports.date')}
                onSort={onSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
              />
              <SortableHeader
                column="status"
                label={t('bugReports.status')}
                onSort={onSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
              />
              <TableHead>{t('bugReports.details')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="font-medium">{report.subject}</TableCell>
                <TableCell>
                  {report.reporterEmail ?? t('bugReports.anonymous')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {report.page ?? '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(report.createdAt, i18n.language)}
                </TableCell>
                <TableCell>
                  {hasWritePermission ? (
                    <StatusSelect
                      current={report.status}
                      onSelect={(next) => onStatusChange(report, next)}
                    />
                  ) : (
                    <StatusBadge status={report.status} />
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    onClick={() => onOpenDetails(report)}
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
            onClick={() => onPageChange(page - 1)}
            size="sm"
            variant="outline"
          >
            {t('common.previous')}
          </Button>
          <Button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            size="sm"
            variant="outline"
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    </>
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
