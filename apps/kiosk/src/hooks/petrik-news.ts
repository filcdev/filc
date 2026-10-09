import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { REFETCH_INTERVALS } from '@/utils/constants';
import { type api, orpc } from '@/utils/orpc';

type KioskPetrikNews = Awaited<ReturnType<typeof api.kiosk.petrikNews>>;

export type PetrikNewsItem = KioskPetrikNews['items'][number];

/** The petrik.hu feed the navigator shows full screen after idling. */
export function usePetrikNews(machine: string): { items: PetrikNewsItem[] } {
  const query = useQuery({
    ...orpc.kiosk.petrikNews.queryOptions({ input: { machine } }),
    refetchInterval: REFETCH_INTERVALS.news,
  });

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
