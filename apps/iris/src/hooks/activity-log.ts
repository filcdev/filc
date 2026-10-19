import type {
  ActivityLogQueryInput,
  activityLogEntrySchema,
} from '@filcdev/api/domains/activity-log';
import { useQuery } from '@tanstack/react-query';
import type { infer as zInfer } from 'zod';
import { orpc } from '@/utils/orpc';

export type ActivityLogEntry = zInfer<typeof activityLogEntrySchema>;

export type ActivityLogFilters = {
  action?: string;
  entityType?: string;
  from?: Date;
  limit?: number;
  offset?: number;
  search?: string;
  to?: Date;
};

const buildQueryInput = (
  filters: ActivityLogFilters
): ActivityLogQueryInput => ({
  limit: filters.limit ?? 50,
  offset: filters.offset ?? 0,
  ...(filters.action && { action: filters.action }),
  ...(filters.entityType && { entityType: filters.entityType }),
  ...(filters.from && { from: filters.from }),
  ...(filters.search && { search: filters.search }),
  ...(filters.to && { to: filters.to }),
});

/** Paged activity log entries for the given filters; server-side filtering. */
export function useActivityLog(filters: ActivityLogFilters) {
  return useQuery({
    ...orpc.activityLog.list.queryOptions({ input: buildQueryInput(filters) }),
    staleTime: 30_000,
  });
}
