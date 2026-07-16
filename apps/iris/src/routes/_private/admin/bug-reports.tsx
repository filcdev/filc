import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { InferResponseType } from 'hono';
import { parseResponse } from 'hono/client';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { queryKeys } from '@/utils/query-keys';

type BugReport = NonNullable<
  InferResponseType<typeof api.bugReport.index.$get>['data']
>[number];

export const Route = createFileRoute('/_private/admin/bug-reports')({
  component: AdminBugReportsPage,
});

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function AdminBugReportsPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<BugReport | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const reportsQuery = useQuery({
    queryFn: async () => {
      const res = await parseResponse(api.bugReport.index.$get());
      if (!res.success) {
        throw new Error('Failed to load bug reports');
      }
      return res.data ?? [];
    },
    queryKey: queryKeys.bugReports(),
  });

  const isLoading = reportsQuery.isLoading;
  const hasError = reportsQuery.isError;
  const reports = reportsQuery.data ?? [];

  const openDetails = (report: BugReport) => {
    setSelected(report);
    setIsDialogOpen(true);
  };

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

      <div className="flex flex-wrap items-center gap-4">
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
        <BugReportsTable onOpenDetails={openDetails} reports={reports} />
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
                    <Badge
                      variant={
                        selected.status === 'resolved' ? 'secondary' : 'outline'
                      }
                    >
                      {selected.status === 'resolved'
                        ? t('bugReports.resolved')
                        : t('bugReports.open')}
                    </Badge>
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
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const resolved = status === 'resolved';
  return (
    <Badge variant={resolved ? 'secondary' : 'outline'}>
      {resolved ? t('bugReports.resolved') : t('bugReports.open')}
    </Badge>
  );
}

type BugReportsTableProps = {
  onOpenDetails: (report: BugReport) => void;
  reports: BugReport[];
};

function BugReportsTable({ onOpenDetails, reports }: BugReportsTableProps) {
  const { t } = useTranslation();
  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <Table className="w-full min-w-3xl">
        <TableHeader>
          <TableRow>
            <TableHead>{t('bugReports.subject')}</TableHead>
            <TableHead>{t('bugReports.reporter')}</TableHead>
            <TableHead>{t('bugReports.page')}</TableHead>
            <TableHead>{t('bugReports.date')}</TableHead>
            <TableHead>{t('bugReports.status')}</TableHead>
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
                {formatDate(report.createdAt)}
              </TableCell>
              <TableCell>
                <StatusBadge status={report.status} />
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
  );
}
