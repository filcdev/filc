import type { EventCheckinResult } from '@filcdev/api/domains/events/checkin';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { orpc } from '@/utils/orpc';

/**
 * The events a helper may check in: the published ones, from the list every
 * signed-in caller already has (`events.list`). No separate picker endpoint is
 * needed — `events:checkin` is a global permission, so the published list is
 * exactly the set the door may scan.
 */
export const useEvents = () =>
  useQuery(orpc.events.list.queryOptions({ input: { limit: 100 } }));

/** What the picker hands the scanner: the id and the two labels it shows. */
export type ScanEvent = {
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
