import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, apiBaseUrl, orpc } from '@/utils/orpc';

type NotificationListPayload = Awaited<
  ReturnType<typeof api.notifications.list>
>;

/** One page of notifications plus how many match the filters in total. */
export type NotificationListResult = NotificationListPayload;

/** A single notification as returned by the list endpoint. */
export type NotificationItem = NotificationListPayload['items'][number];

/** Per-user notification settings, including timetable class colors. */
export type NotificationSettings = Awaited<
  ReturnType<typeof api.notifications.settings>
>;

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
  return useQuery({
    ...orpc.notifications.list.queryOptions({
      input: {
        limit: pageSize,
        offset: page * pageSize,
        ...(type === 'all' ? {} : { type }),
        ...(unread === 'true' || unread === 'false' ? { unread } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      },
    }),
    enabled,
  });
}

/** Mark a single notification as read. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.notifications.markAsRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.notifications.key() });
      },
    })
  );
}

/** Mark every notification as read. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.notifications.markAllAsRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.notifications.key() });
        toast.success(t('notifications.history.markRead'));
      },
    })
  );
}

type UpdateSettingsPayload = Parameters<
  typeof api.notifications.updateSettings
>[0];

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
    ...orpc.notifications.unreadCount.queryOptions(),
    enabled: !!userId,
    // Scoped to the user so a different account never reuses this count.
    queryKey: [...orpc.notifications.unreadCount.key(), userId ?? ''],
    refetchInterval: 30_000,
  });
}

/** Five most recent unread notifications; polls every 30s while signed in. */
export function useRecentNotifications(userId: string | undefined) {
  return useQuery({
    ...orpc.notifications.list.queryOptions({
      input: { limit: 5, offset: 0, unread: 'true' },
    }),
    enabled: !!userId,
    // Scoped to the user so a different account never reuses this page.
    queryKey: [
      ...orpc.notifications.list.key({
        input: { limit: 5, offset: 0, unread: 'true' },
      }),
      userId ?? '',
    ],
    refetchInterval: 30_000,
    select: (payload) => payload.items,
  });
}

/** Notification preference settings for the signed-in user. */
export function useNotificationSettings(enabled: boolean) {
  return useQuery({ ...orpc.notifications.settings.queryOptions(), enabled });
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
      const settings = await api.notifications.updateSettings(payload);
      if (updateCohort) {
        try {
          await updateCohort();
        } catch {
          throw new Error('Failed to update cohort');
        }
      }
      return settings;
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
        queryKey: orpc.notifications.settings.key(),
      });
      toast.success(t('preferences.saveSuccess'));
      onSaved?.();
    },
  });
}

/**
 * Opt out of every notification channel via an unsubscribe token. The backend
 * answers an HTML page (not an oRPC procedure), so this hook posts the form
 * directly and emits no toast: the public page renders its own result panel.
 */
export function useUnsubscribe() {
  return useMutation({
    mutationFn: async ({
      token,
      userId,
    }: {
      token: string;
      userId: string;
    }) => {
      const response = await fetch(`${apiBaseUrl}/notifications/unsubscribe`, {
        body: new URLSearchParams({ token, userId }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }
    },
  });
}
