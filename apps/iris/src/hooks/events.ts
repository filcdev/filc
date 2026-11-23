import type {
  EventRegistrationRole,
  EventRegistrationStatus,
} from '@filcdev/api/domains/events/registration';
import { ERROR_CODE } from '@filcdev/api/errors';
import { isDefinedError } from '@orpc/client';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type api, orpc } from '@/utils/orpc';
import type { MutationCallbacks } from './types';

type EventsResponse = Awaited<ReturnType<typeof api.events.list>>;

export type EventItem = EventsResponse['items'][number];

export type EventDetail = Awaited<ReturnType<typeof api.events.get>>;

export type EventFieldItem = EventDetail['fields'][number];

/** One room of an event with its remaining places, as the detail answers it. */
export type EventRoomItem = EventDetail['rooms'][number];

export type EventPayload = Parameters<typeof api.events.create>[0];

/** The admin table is not paged: it asks for one generous page. */
export const EVENTS_PAGE_SIZE = 100;

/**
 * Every event, drafts and archived included, for the organizer table. The
 * payload keeps `total`, so the table can say how many rows exist beyond the
 * one page it fetches.
 */
export function useEvents(enabled = true) {
  return useQuery({
    ...orpc.events.list.queryOptions({
      input: {
        includeDrafts: 'true',
        limit: EVENTS_PAGE_SIZE,
        offset: 0,
      },
    }),
    enabled,
  });
}

function useInvalidateEvents() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: orpc.events.list.key() });
    queryClient.invalidateQueries({ queryKey: orpc.events.get.key() });
    // Replacing questions prunes every scanner's rules, so those move too.
    queryClient.invalidateQueries({
      queryKey: orpc.events.checkinConfigs.list.key(),
    });
    // A registration change moves the organizer's list, its numbers and the
    // seat counts the event itself reports.
    queryClient.invalidateQueries({
      queryKey: orpc.events.registrations.list.key(),
    });
    queryClient.invalidateQueries({ queryKey: orpc.events.stats.key() });
  };
}

export function useCreateEvent({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.createError'));
      },
      onSuccess: () => {
        toast.success(t('events.createSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

export function useUpdateEvent({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.updateError'));
      },
      onSuccess: () => {
        toast.success(t('events.updateSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

export function useDeleteEvent({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('events.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

export type EventImageUploadPayload = { file: File; id: string };

export function useUploadEventImage({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.uploadImage.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.bannerUploadError'));
      },
      onSuccess: () => {
        toast.success(t('events.bannerUploadSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

export function useDeleteEventImage({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.deleteImage.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.bannerRemoveError'));
      },
      onSuccess: () => {
        toast.success(t('events.bannerRemoveSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

export function useReplaceEventFields({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.fields.replace.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.questionsSaveError'));
      },
      onSuccess: () => {
        toast.success(t('events.questionsSaved'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

export function useCreateEventRoom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.rooms.create.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.rooms.createError'));
      },
      onSuccess: () => {
        toast.success(t('events.rooms.createSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

export function useUpdateEventRoom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.rooms.update.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.rooms.updateError'));
      },
      onSuccess: () => {
        toast.success(t('events.rooms.updateSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

export function useDeleteEventRoom({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.rooms.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.rooms.deleteError'));
      },
      onSuccess: () => {
        toast.success(t('events.rooms.deleteSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** The registration a caller owns, as the detail endpoint returns it. */
export type EventRegistrationItem = NonNullable<EventDetail['myRegistration']>;

/** How often the public pages re-read seats and the list while open. */
export const EVENTS_REFETCH_MS = 10_000;

/**
 * The published events, for the public list. No `includeDrafts`: a visitor and
 * a signed-in student get the same rows, which is the product rule — cohort
 * targeting is registration scope, not visibility.
 */
export function usePublicEvents() {
  return useQuery({
    ...orpc.events.list.queryOptions({
      input: { limit: EVENTS_PAGE_SIZE, offset: 0 },
    }),
    refetchInterval: EVENTS_REFETCH_MS,
    select: (payload) => payload.items,
  });
}

/**
 * One event with its seats and the caller's own registration. The interval is
 * what keeps a seat count honest while a student fills the form; the query
 * stops polling when the page unmounts.
 */
export function useEventDetail(id: string, enabled = true) {
  return useQuery({
    ...orpc.events.get.queryOptions({ input: { id } }),
    enabled,
    refetchInterval: EVENTS_REFETCH_MS,
  });
}

export function useCreateEventRegistration({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.registrations.create.mutationOptions({
      onError: (error) => {
        // The room limits are their own codes so the loser of a race is told
        // which limit filled up, not just that the event is full.
        if (isDefinedError(error)) {
          if (error.code === ERROR_CODE.ROOM_FULL) {
            toast.error(t('events.public.reasons.room_full'));
            return;
          }
          if (error.code === ERROR_CODE.ROOM_REQUIRED) {
            toast.error(t('events.public.reasons.room_required'));
            return;
          }
        }
        toast.error(error.message || t('events.public.registerError'));
      },
      onSuccess: (registration) => {
        // A helper signup is created pending, so its success says so instead of
        // claiming a confirmed place.
        toast.success(
          t(
            registration.role === 'helper'
              ? 'events.public.helperApplied'
              : 'events.public.registerSuccess'
          )
        );
        invalidate();
        onSaved?.();
      },
    })
  );
}

export function useCancelEventRegistration({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.registrations.cancel.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.public.cancelError'));
      },
      onSuccess: () => {
        toast.success(t('events.public.cancelSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/**
 * Withdrawing a helper application that is still waiting for approval.
 *
 * It is the same endpoint a confirmed student cancels with, which today only
 * accepts a confirmed row: a pending one answers `NOT_FOUND`. That case gets its
 * own copy — the organizer is the one who can still remove it — instead of a
 * misleading "registration not found".
 */
export function useWithdrawHelperRegistration({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.registrations.cancel.mutationOptions({
      onError: (error) => {
        if (isDefinedError(error) && error.code === ERROR_CODE.NOT_FOUND) {
          toast.error(t('events.public.helperWithdrawUnavailable'));
          return;
        }
        toast.error(error.message || t('events.public.cancelError'));
      },
      onSuccess: () => {
        toast.success(t('events.public.helperWithdrawn'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** The guest signup result, as the page needs it after a successful submit. */
export type GuestRegistrationResult = {
  code: string;
  registrationId: string;
};

/**
 * A visitor's signup. Public, so no session is involved; the success result is
 * the created ticket, which the page shows instead of the form.
 */
export function useGuestRegistration() {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.guests.create.mutationOptions({
      onError: (error) => {
        if (isDefinedError(error)) {
          if (error.code === ERROR_CODE.ROOM_FULL) {
            toast.error(t('events.public.reasons.room_full'));
            return;
          }
          if (error.code === ERROR_CODE.ROOM_REQUIRED) {
            toast.error(t('events.public.reasons.room_required'));
            return;
          }
        }
        toast.error(error.message || t('events.public.guestError'));
      },
      onSuccess: () => {
        toast.success(t('events.public.guestSuccess'));
        // The seat count and the guest list both moved.
        invalidate();
      },
    })
  );
}

/** One ticket by its code, for the public ticket page. */
export function useEventTicket(ticketId: string) {
  return useQuery(orpc.tickets.get.queryOptions({ input: { ticketId } }));
}

/**
 * One event as the organizer's page reads it: drafts included, because the
 * detail page is also how a draft is reviewed before publishing.
 */
export function useAdminEventDetail(id: string, enabled = true) {
  return useQuery({
    ...orpc.events.get.queryOptions({
      input: { id, includeDrafts: 'true' },
    }),
    enabled,
  });
}

/** The organizer's participant page size; the API caps a page at 100. */
export const PARTICIPANTS_PAGE_SIZE = 20;

export type EventParticipantItem = Awaited<
  ReturnType<typeof api.events.registrations.list>
>['items'][number];

export type EventStatsData = Awaited<ReturnType<typeof api.events.stats>>;

export type ParticipantFilters = {
  id: string;
  limit?: number;
  offset?: number;
  role?: EventRegistrationRole;
  search?: string;
  status?: EventRegistrationStatus;
};

/**
 * One page of an event's registrations. The previous page stays on screen while
 * the next one loads, so paging and filtering do not blank the table. The
 * interval is what brings a registration made elsewhere into the list, and it
 * stops when the table unmounts (and while the tab is hidden).
 */
export function useEventParticipants(
  filters: ParticipantFilters,
  enabled = true
) {
  return useQuery({
    ...orpc.events.registrations.list.queryOptions({
      input: {
        id: filters.id,
        limit: filters.limit ?? PARTICIPANTS_PAGE_SIZE,
        offset: filters.offset ?? 0,
        ...(filters.role ? { role: filters.role } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
    }),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: EVENTS_REFETCH_MS,
  });
}

/**
 * The organizer's numbers: seats, role and status counts, answers, timeline.
 * A student registering elsewhere moves the seat count, so it is re-read on the
 * same interval as the public pages; polling stops when the view unmounts (and
 * while the tab is hidden).
 */
export function useEventStats(id: string, enabled = true) {
  return useQuery({
    ...orpc.events.stats.queryOptions({ input: { id } }),
    enabled,
    refetchInterval: EVENTS_REFETCH_MS,
  });
}

/** One scanner's door config, or the event default when `userId` is null. */
export type EventCheckinConfigItem = Awaited<
  ReturnType<typeof api.events.checkinConfigs.list>
>['items'][number];

/** The event's door configs: its default plus each helper override. */
export function useEventCheckinConfigs(eventId: string, enabled = true) {
  return useQuery({
    ...orpc.events.checkinConfigs.list.queryOptions({ input: { id: eventId } }),
    enabled,
  });
}

/**
 * Writes one scanner's rules. `userId: null` writes the event default; an id
 * writes that helper's override. Both are upserts, so saving twice keeps one
 * row.
 */
export function useUpsertEventCheckinConfig({
  onSaved,
}: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.checkinConfigs.upsert.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.checkinConfigs.saveError'));
      },
      onSuccess: () => {
        toast.success(t('events.checkinConfigs.saved'));
        queryClient.invalidateQueries({
          queryKey: orpc.events.checkinConfigs.list.key(),
        });
        onSaved?.();
      },
    })
  );
}

/** Drops a helper's override, so their next scan uses the event default. */
export function useDeleteEventCheckinConfig({
  onSaved,
}: MutationCallbacks = {}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.checkinConfigs.delete.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.checkinConfigs.resetError'));
      },
      onSuccess: () => {
        toast.success(t('events.checkinConfigs.resetSuccess'));
        queryClient.invalidateQueries({
          queryKey: orpc.events.checkinConfigs.list.key(),
        });
        onSaved?.();
      },
    })
  );
}

/**
 * A manager cancelling someone else's registration. The endpoint is the same
 * one a student calls for their own row; only the copy differs here.
 */
export function useCancelEventParticipant({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.registrations.cancel.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.participants.cancelError'));
      },
      onSuccess: () => {
        toast.success(t('events.participants.cancelSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/** Re-sends a visitor's ticket email with the same code. */
export function useResendEventTicket({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.registrations.resend.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.participants.resendError'));
      },
      onSuccess: () => {
        toast.success(t('events.participants.resendSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/**
 * Ends an approved helper's door access before it expires. The registration is
 * untouched: the helper stays confirmed, only the scanner stops accepting them.
 */
export function useRevokeCheckinGrant({ onSaved }: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.registrations.revokeCheckinGrant.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.participants.revokeGrantError'));
      },
      onSuccess: () => {
        toast.success(t('events.participants.revokeGrantSuccess'));
        invalidate();
        onSaved?.();
      },
    })
  );
}

/**
 * The organizer's answer to a pending helper signup. The returned row is
 * confirmed after an approval and cancelled after a decline, which is what the
 * success toast reads.
 */
export function useDecideEventRegistration({
  onSaved,
}: MutationCallbacks = {}) {
  const invalidate = useInvalidateEvents();
  const { t } = useTranslation();
  return useMutation(
    orpc.events.registrations.decide.mutationOptions({
      onError: (error: Error) => {
        toast.error(error.message || t('events.participants.decideError'));
      },
      onSuccess: (registration) => {
        toast.success(
          t(
            registration.status === 'confirmed'
              ? 'events.participants.approved'
              : 'events.participants.declined'
          )
        );
        invalidate();
        onSaved?.();
      },
    })
  );
}
