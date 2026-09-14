import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { NewsTakeover } from '@/components/tv/news-takeover';
import { Loading } from '@/components/tv/query-states';
import { TvApp } from '@/components/tv/tv-app';
import { useKioskHeartbeat } from '@/hooks/kiosk';
import { type NewsTakeoverPolicy, useActiveTimetable } from '@/hooks/tv';

export const Route = createFileRoute('/_kiosk/tv')({
  component: TvKioskPage,
});

/**
 * PetrikTV ticker. Nothing is painted until the heartbeat has handed over the
 * kiosk's config and the active timetable is known, so a box booted before the
 * school's data is up never flashes an empty board.
 */
function TvKioskPage() {
  const { machine } = Route.useSearch();
  const heartbeat = useKioskHeartbeat(machine);
  const timetable = useActiveTimetable();

  // A box with a physical keyboard can be reloaded with "r" — there is no
  // updater any more.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'r') {
        window.location.reload();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Re-enrolled as a navigator box: follow the registry instead of spinning.
  if (heartbeat?.state === 'navigator') {
    return <Navigate replace search={{ machine }} to="/navigator" />;
  }

  if (heartbeat?.state !== 'tv' || timetable.isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  const newsPolicy: NewsTakeoverPolicy = {
    highlightedNews: heartbeat.config.highlightedNews,
    kioskId: heartbeat.kiosk.id,
    newsImages: heartbeat.config.newsImages,
  };

  // The ticker is a dark board: the TV shell opts into the dark token set, so
  // every colour on it comes from the shared UI theme.
  return (
    <div className="tv dark h-dvh w-screen">
      <TvApp departures={heartbeat.config.departures} newsPolicy={newsPolicy} />
      {/* Sibling of the ticker, not a child: `.tv main` is zoomed, and a fixed
          overlay inside it would inherit that scale. */}
      <NewsTakeover
        dwellMs={heartbeat.config.newsSlideSeconds * 1000}
        policy={newsPolicy}
        tickerMs={heartbeat.config.newsTickerSeconds * 1000}
      />
    </div>
  );
}
