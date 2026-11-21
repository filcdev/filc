import type { EventCheckinResult } from '@filcdev/api/domains/events/checkin';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { orpc } from '@/utils/orpc';

/**
 * The events this caller may check tickets in at.
 *
 * The endpoint answers the global `events:checkin` holder with every published,
 * not-ended event, and everyone else with only their own unexpired door grants
 * (each carrying its expiry). A caller with neither answers 403, which the
 * picker renders as the no-access screen.
 */
export const useEvents = () => useQuery(orpc.events.scan.queryOptions());

/** What the picker hands the scanner: the id, the labels and the grant end. */
export type ScanEvent = {
  expiresAt: Date | null;
  id: string;
  startsAt: Date;
  title: string;
};

/**
 * One check-in at a time. The camera and the manual field both call `submit`,
 * so the panel the door renders has one source.
 */
export const useCheckin = (eventId: string) => {
  const [result, setResult] = useState<EventCheckinResult | null>(null);
  const {
    error,
    isPending,
    mutate,
    reset: resetMutation,
  } = useMutation(
    orpc.events.checkin.mutationOptions({
      onSuccess: (data) => setResult(data),
    })
  );

  const submit = useCallback(
    (code: string) => {
      mutate({ code, id: eventId });
    },
    [eventId, mutate]
  );

  const reset = useCallback(() => {
    setResult(null);
    resetMutation();
  }, [resetMutation]);

  return { error, isPending, reset, result, submit };
};
