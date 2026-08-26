import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type InferRequestType,
  type InferResponseType,
  parseResponse,
} from 'hono/client';
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
export function useNotifications(
  filters: NotificationListFilters,
  options: { enabled?: boolean } = {}
) {
  const { dateFrom, dateTo, page, pageSize, type, unread } = filters;
  const enabled = options.enabled ?? true;
  return useQuery<NotificationListResult>({
    enabled,
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

type UpdateSettingsPayload = InferRequestType<
  typeof api.notifications.settings.$patch
>['json'];

/** Options accepted by useUpdateNotificationSettings. */
type UpdateSettingsCallbacks = {
  /** Runs after the patch succeeds but before success handling fails the flow on error. */
  updateCohort?: () => Promise<void>;
  /** Called after the settings are saved successfully. */
  onSaved?: () => void;
};

/** Unread notification count for the badge; polls every 30s while signed in. */
export function useUnreadNotificationCount(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryFn: async () => {
      const res = await parseResponse(api.notifications['unread-count'].$get());
      if (!res.success) {
        throw new Error('Failed to load unread notification count');
      }
      return res.data;
    },
    queryKey: queryKeys.notifications.unreadCount(userId ?? ''),
    refetchInterval: 30_000,
  });
}

/** Five most recent unread notifications; polls every 30s while signed in. */
export function useRecentNotifications(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryFn: async () => {
      const res = await parseResponse(
        api.notifications.index.$get({
          query: { limit: '5', offset: '0', unread: 'true' },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load recent notifications');
      }
      return (res.data ?? []) as NotificationItem[];
    },
    queryKey: queryKeys.notifications.recent(userId ?? ''),
    refetchInterval: 30_000,
  });
}

/** Notification preference settings for the signed-in user. */
export function useNotificationSettings(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async () => {
      const res = await parseResponse(api.notifications.settings.$get());
      if (!res.success) {
        throw new Error('Failed to load notification settings');
      }
      return res.data;
    },
    queryKey: queryKeys.notifications.settings(),
  });
}

/** Save notification preference settings. */
export function useUpdateNotificationSettings({
  onSaved,
  updateCohort,
}: UpdateSettingsCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: UpdateSettingsPayload) => {
      const res = await parseResponse(
        api.notifications.settings.$patch({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to save settings');
      }
      if (updateCohort) {
        try {
          await updateCohort();
        } catch {
          throw new Error('Failed to update cohort');
        }
      }
      return res;
    },
    onError: (error) => {
      if (
        error instanceof Error &&
        error.message === 'Failed to update cohort'
      ) {
        toast.error(t('welcome.cohortSaveFailed'));
        return;
      }
      toast.error(t('preferences.saveError'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.settings(),
      });
      toast.success(t('preferences.saveSuccess'));
      onSaved?.();
    },
  });
}
