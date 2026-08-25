import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type InferResponseType, parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type NotificationListResponse = InferResponseType<
  typeof api.notifications.index.$get
>;

/** Success-branch envelope of the list endpoint, with optional total. */
export type NotificationListResult = {
  data: NonNullable<
    Extract<NotificationListResponse, { success: true }>['data']
  >;
  success: true;
  total?: number;
};

/** A single notification as returned by the list endpoint. */
export type NotificationItem = NonNullable<
  NotificationListResult['data']
>[number];

type NotificationListFilters = {
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  type: string;
  unread: string;
};
export function useNotifications(filters: NotificationListFilters) {
  const { dateFrom, dateTo, page, pageSize, type, unread } = filters;
  return useQuery<NotificationListResult>({
    queryFn: () => {
      const query: Record<string, string | undefined> = {
        limit: String(pageSize),
        offset: String(page * pageSize),
      };
      if (type !== 'all') {
        query.type = type;
      }
      if (unread === 'true' || unread === 'false') {
        query.unread = unread;
      }
      if (dateFrom) {
        query.dateFrom = dateFrom;
      }
      if (dateTo) {
        query.dateTo = dateTo;
      }
      return parseResponse(
        api.notifications.index.$get({ query })
      ) as unknown as NotificationListResult;
    },
    queryKey: [
      ...queryKeys.notifications.list({
        dateFrom,
        dateTo,
        page,
        type,
        unread,
      }),
      pageSize,
    ],
  });
}

/** Mark a single notification as read. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.notifications[':id'].read.$patch({ param: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all(),
      });
    },
  });
}

/** Mark every notification as read. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: () => api.notifications['read-all'].$patch(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all(),
      });
      toast.success(t('notifications.history.markRead'));
    },
  });
}
