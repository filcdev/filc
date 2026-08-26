import { useQuery } from '@tanstack/react-query';
import { type InferResponseType, parseResponse } from 'hono/client';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type BugReportsResponse = InferResponseType<typeof api.bugReport.index.$get>;

export type BugReportItem = NonNullable<BugReportsResponse['data']>[number];

/** All bug reports (admin view), newest first. */
export function useBugReports() {
  return useQuery({
    queryFn: async (): Promise<BugReportItem[]> => {
      const res = await parseResponse(api.bugReport.index.$get());
      if (!res.success) {
        throw new Error('Failed to load bug reports');
      }
      return res.data as BugReportItem[];
    },
    queryKey: queryKeys.bugReports(),
  });
}
