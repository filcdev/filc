import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type api, orpc } from '@/utils/orpc';

export const bugReportStatuses = [
  'open',
  'in_progress',
  'resolved',
  'closed',
] as const;

export type BugReportStatus = (typeof bugReportStatuses)[number];

type BugReportsListResponse = Awaited<ReturnType<typeof api.bugReport.list>>;

export type BugReportItem = Omit<
  BugReportsListResponse['reports'][number],
  'status'
> & { status: BugReportStatus };

type BugReportsList = Omit<BugReportsListResponse, 'reports'> & {
  reports: BugReportItem[];
};

export type BugReportFilters = {
  dateFrom: string;
  dateTo: string;
  page: number;
  search: string;
  status: string;
};

const PAGE_SIZE = 20;

/** Paged + filtered bug reports (admin view). */
export function useBugReports(filters: BugReportFilters) {
  return useQuery({
    ...orpc.bugReport.list.queryOptions({
      input: {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        limit: PAGE_SIZE,
        page: filters.page,
        search: filters.search || undefined,
        status:
          filters.status === 'all'
            ? undefined
            : (filters.status as BugReportStatus),
      },
    }),
    // The status column is plain text in the database; the admin UI only ever
    // shows the four statuses this hook's consumers already knew.
    select: (payload): BugReportsList => ({
      ...payload,
      reports: payload.reports as BugReportItem[],
    }),
  });
}

/** Update a bug report's status (PATCH /:id/status). */
export function useUpdateBugReportStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.bugReport.updateStatus.mutationOptions({
      onError: () => {
        toast.error(t('bugReports.statusUpdateError'));
      },
      onSuccess: () => {
        toast.success(t('bugReports.statusUpdateSuccess'));
        queryClient.invalidateQueries({ queryKey: orpc.bugReport.list.key() });
      },
    })
  );
}

/** Delete a bug report (DELETE /:id). */
export function useDeleteBugReport({ onSaved }: { onSaved?: () => void } = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.bugReport.delete.mutationOptions({
      onError: () => {
        toast.error(t('bugReports.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('bugReports.deleteSuccess'));
        queryClient.invalidateQueries({ queryKey: orpc.bugReport.list.key() });
        onSaved?.();
      },
    })
  );
}
