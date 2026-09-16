import type { InferResponseType } from 'hono/client';
import { useEffect, useState } from 'react';
import { api, useApiQuery } from '@/utils/api';
import { REFETCH_INTERVALS } from '@/utils/constants';

type KioskPetrikNews = InferResponseType<
  (typeof api.kiosk)['petrik-news']['$get'],
  200
>['data'];

export type PetrikNewsItem = KioskPetrikNews['items'][number];

/** The petrik.hu feed the navigator shows full screen after idling. */
export function usePetrikNews(machine: string): { items: PetrikNewsItem[] } {
  const query = useApiQuery<KioskPetrikNews>(
    () => api.kiosk['petrik-news'].$get({ query: { machine } }),
    {
      queryKey: ['kiosk', 'petrik-news', machine],
      refetchInterval: REFETCH_INTERVALS.news,
    }
  );

  return { items: query.data?.items ?? [] };
}

/**
 * One item at a time for `dwellMs`, looping back to the start. The index
 * restarts when the feed's length changes, and `advance` skips an item whose
 * image failed to load.
 */
export function usePetrikNewsSlideshow(
  items: PetrikNewsItem[],
  dwellMs: number
): { advance: () => void; current: PetrikNewsItem | null } {
  const [index, setIndex] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the length is the trigger, not a value the effect reads
  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const timer = setInterval(() => {
      setIndex((previous) => (previous + 1) % items.length);
    }, dwellMs);

    return () => clearInterval(timer);
  }, [dwellMs, items.length]);

  const advance = () => {
    if (items.length === 0) {
      return;
    }
    setIndex((previous) => (previous + 1) % items.length);
  };

  return { advance, current: items[index] ?? null };
}
