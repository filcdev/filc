import { useQueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useApiMutation, useApiQuery } from '@/utils/api';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

export const bugReportStatuses = [
  'open',
  'in_progress',
  'solved',
  'closed',
] as const;

export type BugReportStatus = (typeof bugReportStatuses)[number];

type BugReportsListResponse = NonNullable<
  InferResponseType<typeof api.bugReport.index.$get>['data']
>;

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
  return useApiQuery<BugReportsList>(
    () =>
      api.bugReport.index.$get({
        query: {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          limit: PAGE_SIZE.toString(),
          page: filters.page.toString(),
          search: filters.search || undefined,
          status:
            filters.status === 'all'
              ? undefined
              : (filters.status as BugReportStatus),
        },
      }),
    { queryKey: queryKeys.bugReports.list(filters) }
  );
}

/** Update a bug report's status (PATCH /:id/status). */
export function useUpdateBugReportStatus() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useApiMutation<BugReportItem, { id: string; status: BugReportStatus }>(
    {
      mutationFn: ({ id, status }) =>
        api.bugReport[':id'].status.$patch({
          json: { status },
          param: { id },
        }),
      onError: () => {
        toast.error(t('bugReports.statusUpdateError'));
      },
      onSuccess: () => {
        toast.success(t('bugReports.statusUpdateSuccess'));
        queryClient.invalidateQueries({ queryKey: queryKeys.bugReports.all() });
      },
    }
  );
}
