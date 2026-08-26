import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { parseResponse } from 'hono/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '@/utils/hc';
import { queryKeys } from '@/utils/query-keys';

type AnnouncementsResponse = InferResponseType<
  typeof api.news.announcements.$get
>;

export type AnnouncementItem = NonNullable<
  AnnouncementsResponse['data']
>[number];

export type AnnouncementPayload = InferRequestType<
  typeof api.news.announcements.$post
>['json'];

type SystemMessagesResponse = InferResponseType<
  (typeof api.news)['system-messages']['$get']
>;

export type SystemMessageItem = NonNullable<
  SystemMessagesResponse['data']
>[number];

export type SystemMessagePayload = InferRequestType<
  (typeof api.news)['system-messages']['$post']
>['json'];

type CohortsResponse = InferResponseType<typeof api.cohort.index.$get>;

export type Cohort = NonNullable<CohortsResponse['data']>[number];

/** Options accepted by every mutation hook: react to a successful save. */
type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Full announcement list including expired entries. */
export function useAnnouncements() {
  return useQuery({
    queryFn: async (): Promise<AnnouncementItem[]> => {
      const res = await parseResponse(
        api.news.announcements.$get({
          query: { includeExpired: 'true' },
        })
      );
      if (!res.success) {
        throw new Error('Failed to load announcements');
      }
      return res.data as AnnouncementItem[];
    },
    queryKey: queryKeys.news.announcements(),
  });
}

/** System message list for the admin table; only fetched when enabled. */
export function useAdminSystemMessages(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<SystemMessageItem[]> => {
      const res = await parseResponse(
        api.news['system-messages'].$get({ query: {} })
      );
      if (!res.success) {
        throw new Error('Failed to load system messages');
      }
      return res.data as SystemMessageItem[];
    },
    queryKey: queryKeys.news.adminSystemMessages(),
  });
}

/** Cohort list for pickers and filters; only fetched when enabled. */
export function useCohorts(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<Cohort[]> => {
      const res = await parseResponse(api.cohort.index.$get());
      if (!(res.success && res.data)) {
        throw new Error('Failed to load cohorts');
      }
      return res.data as Cohort[];
    },
    queryKey: queryKeys.cohorts(),
  });
}

function useInvalidateAnnouncements() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.news.announcements() });
}

function useInvalidateSystemMessages() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.news.adminSystemMessages(),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.news.systemMessagesBanner(),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.news.systemMessagesPanel(),
    });
  };
}

/** Create an announcement. */
export function useCreateAnnouncement({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateAnnouncements();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: AnnouncementPayload) => {
      const res = await parseResponse(
        api.news.announcements.$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create announcement');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('announcements.createError'));
    },
    onSuccess: () => {
      toast.success(t('announcements.createSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Update an existing announcement by id. */
export function useUpdateAnnouncement({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateAnnouncements();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: AnnouncementPayload;
    }) => {
      const res = await parseResponse(
        api.news.announcements[':id'].$patch({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update announcement');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('announcements.updateError'));
    },
    onSuccess: () => {
      toast.success(t('announcements.updateSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete an announcement by id. */
export function useDeleteAnnouncement({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateAnnouncements();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.news.announcements[':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete announcement');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('announcements.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('announcements.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Create a system message. */
export function useCreateSystemMessage({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSystemMessages();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (payload: SystemMessagePayload) => {
      const res = await parseResponse(
        api.news['system-messages'].$post({ json: payload })
      );
      if (!res.success) {
        throw new Error('Failed to create system message');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('systemMessages.createError'));
    },
    onSuccess: () => {
      toast.success(t('systemMessages.createSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Update an existing system message by id. */
export function useUpdateSystemMessage({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSystemMessages();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: SystemMessagePayload;
    }) => {
      const res = await parseResponse(
        api.news['system-messages'][':id'].$patch({
          json: payload,
          param: { id },
        })
      );
      if (!res.success) {
        throw new Error('Failed to update system message');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('systemMessages.updateError'));
    },
    onSuccess: () => {
      toast.success(t('systemMessages.updateSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}

/** Delete a system message by id. */
export function useDeleteSystemMessage({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSystemMessages();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await parseResponse(
        api.news['system-messages'][':id'].$delete({ param: { id } })
      );
      if (!res.success) {
        throw new Error('Failed to delete system message');
      }
      return res;
    },
    onError: (error: Error) => {
      toast.error(error.message || t('systemMessages.deleteError'));
    },
    onSuccess: () => {
      toast.success(t('systemMessages.deleteSuccess'));
      invalidate();
      onSaved?.();
    },
  });
}
