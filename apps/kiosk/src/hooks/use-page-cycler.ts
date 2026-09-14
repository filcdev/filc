import { useEffect, useState } from 'react';

type UsePageCyclerOptions = {
  cycleInterval: number;
  totalPages: number;
};

/**
 * Paging for a ticker table that is too long to show at once: cycles through
 * the pages so every row is seen. Returns to the first page whenever the row
 * count changes, so a burst of new substitutions is never missed.
 */
export function usePageCycler({
  cycleInterval,
  totalPages,
}: UsePageCyclerOptions): number {
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    // A shorter list can leave the current page past the end.
    setPageIndex((current) => (current < totalPages ? current : 0));
  }, [totalPages]);

  useEffect(() => {
    if (totalPages <= 1) {
      return;
    }

    const timer = setInterval(
      () => setPageIndex((previous) => (previous + 1) % totalPages),
      cycleInterval
    );

    return () => clearInterval(timer);
  }, [cycleInterval, totalPages]);

  return pageIndex;
}
