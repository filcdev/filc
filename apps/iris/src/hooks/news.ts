import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { sortCohorts } from '@/utils/cohort';
import { type api, orpc } from '@/utils/orpc';

type AnnouncementsResponse = Awaited<
  ReturnType<typeof api.news.announcements.list>
>;

export type AnnouncementItem = AnnouncementsResponse['data'][number];

export type AnnouncementPayload = Parameters<
  typeof api.news.announcements.create
>[0];

type SystemMessagesResponse = Awaited<
  ReturnType<typeof api.news.systemMessages.list>
>;

export type SystemMessageItem = SystemMessagesResponse['data'][number];

export type SystemMessagePayload = Parameters<
  typeof api.news.systemMessages.create
>[0];

type CohortsResponse = Awaited<ReturnType<typeof api.cohort.cohort>>;

export type Cohort = CohortsResponse[number];

/** Options accepted by every mutation hook: react to a successful save. */
type MutationCallbacks = {
  /** Called after success toast + cache invalidation; use to close dialogs. */
  onSaved?: () => void;
};

/** Full announcement list including expired entries. */
export function useAnnouncements() {
  return useQuery({
    ...orpc.news.announcements.list.queryOptions({
      // The admin table is the one place kiosk-only items stay visible.
      input: {
        includeAll: 'true',
        includeExpired: 'true',
        includeKioskOnly: 'true',
      },
    }),
    select: (payload) => payload.data,
  });
}

/** Active announcements for the public panel; only fetched when enabled. */
export function useAnnouncementsPanel(enabled: boolean) {
  return useQuery({
    ...orpc.news.announcements.list.queryOptions({
      input: { includeAll: 'true' },
    }),
    enabled,
    select: (payload) => payload.data,
  });
}

/** System message list for the admin table; only fetched when enabled. */
export function useAdminSystemMessages(enabled: boolean) {
  return useQuery({
    ...orpc.news.systemMessages.list.queryOptions({ input: {} }),
    enabled,
    select: (payload) => payload.data,
  });
}

/** Cohort list for pickers and filters; only fetched when enabled. */
export function useCohorts(enabled: boolean) {
  return useQuery({
    ...orpc.cohort.cohort.queryOptions(),
    enabled,
    select: sortCohorts,
  });
}

function useInvalidateAnnouncements() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.news.announcements.list.key(),
    });
  };
}

function useInvalidateSystemMessages() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: orpc.news.systemMessages.list.key(),
    });
  };
}

/** Create an announcement. */
export function useCreateAnnouncement({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateAnnouncements();
  const { t } = useTranslation();
  return useMutation(
    orpc.news.announcements.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('announcements.createError'));
      },
      onSuccess: () => {
        toast.success(t('announcements.createSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Update an existing announcement by id. */
export function useUpdateAnnouncement({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateAnnouncements();
  const { t } = useTranslation();
  return useMutation(
    orpc.news.announcements.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('announcements.updateError'));
      },
      onSuccess: () => {
        toast.success(t('announcements.updateSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Delete an announcement by id. */
export function useDeleteAnnouncement({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateAnnouncements();
  const { t } = useTranslation();
  return useMutation(
    orpc.news.announcements.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('announcements.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('announcements.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** What the kiosk image upload needs: the announcement and the picked file. */
export type AnnouncementImageUploadPayload = { file: File; id: string };

/** Upload (or replace) the image an announcement shows on the kiosk. */
export function useUploadAnnouncementImage({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateAnnouncements();
  const { t } = useTranslation();
  return useMutation(
    orpc.news.announcements.uploadImage.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('announcements.imageUploadError'));
      },
      onSuccess: () => {
        toast.success(t('announcements.imageUploadSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Remove the kiosk image of an announcement; the announcement stays. */
export function useDeleteAnnouncementImage({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateAnnouncements();
  const { t } = useTranslation();
  return useMutation(
    orpc.news.announcements.deleteImage.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('announcements.imageRemoveError'));
      },
      onSuccess: () => {
        toast.success(t('announcements.imageRemoveSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Create a system message. */
export function useCreateSystemMessage({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSystemMessages();
  const { t } = useTranslation();
  return useMutation(
    orpc.news.systemMessages.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('systemMessages.createError'));
      },
      onSuccess: () => {
        toast.success(t('systemMessages.createSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Update an existing system message by id. */
export function useUpdateSystemMessage({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSystemMessages();
  const { t } = useTranslation();
  return useMutation(
    orpc.news.systemMessages.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('systemMessages.updateError'));
      },
      onSuccess: () => {
        toast.success(t('systemMessages.updateSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Delete a system message by id. */
export function useDeleteSystemMessage({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateSystemMessages();
  const { t } = useTranslation();
  return useMutation(
    orpc.news.systemMessages.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('systemMessages.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('systemMessages.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}
