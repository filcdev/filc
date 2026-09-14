import type { DepartureGroup } from '@filcdev/api/domains/kiosk/config';
import type { InferResponseType } from 'hono/client';
import { useEffect, useMemo, useState } from 'react';
import { TV_STRINGS } from '@/components/tv/strings';
import { api, useApiQuery } from '@/utils/api';
import { REFETCH_INTERVALS } from '@/utils/constants';
import { dayjs } from '@/utils/dayjs';
import { isPeriodOver } from '@/utils/periods';

type LatestValidTimetable = InferResponseType<
  typeof api.timetable.timetables.latestValid.$get,
  200
>['data'];
type Periods = InferResponseType<
  typeof api.timetable.periods.getAll.$get,
  200
>['data'];
type Substitutions = InferResponseType<
  typeof api.timetable.substitutions.$get,
  200
>['data'];
type MovedLessons = InferResponseType<
  typeof api.timetable.movedLessons.$get,
  200
>['data'];
type KioskNews = InferResponseType<typeof api.kiosk.news.$get, 200>['data'];
type KioskWeather = InferResponseType<
  typeof api.kiosk.weather.$get,
  200
>['data'];
type KioskDepartures = InferResponseType<
  typeof api.kiosk.departures.$post,
  200
>['data'];

/** One announcement of the kiosk feed, as the full-screen takeover shows it. */
export type KioskNewsItem = KioskNews['announcements'][number];

/** One row of the substitution ticker. */
export type TvSubstitutionRow = {
  /** The substituter is null, so the lesson was called off. */
  cancelled: boolean;
  className: string;
  classroom: string;
  lesson: number;
  missing: string;
  teacher: string;
};

/** One row of the room-change ticker. */
export type TvRoomChangeRow = {
  class: string;
  from: string;
  lesson: number;
  to: string;
};

/** Today, in the box's own timezone — the ticker is a wall clock. */
function isToday(date: string | Date): boolean {
  return dayjs(date).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');
}

/**
 * The timetable the ticker filters against plus every period it defines.
 * Period boundaries live in the database, so the ticker follows the real bell
 * schedule instead of a hardcoded one.
 */
export function useActiveTimetable() {
  const timetable = useApiQuery<LatestValidTimetable>(
    () => api.timetable.timetables.latestValid.$get(),
    {
      queryKey: ['timetable', 'latestValid'],
      refetchInterval: REFETCH_INTERVALS.timetable,
      retry: false,
    }
  );

  const timetableId = timetable.data?.id;

  const periods = useApiQuery<Periods>(
    () =>
      api.timetable.periods.getAll.$get({
        query: timetableId ? { timetableId } : {},
      }),
    {
      enabled: !!timetableId,
      queryKey: ['timetable', 'periods', timetableId],
      refetchInterval: REFETCH_INTERVALS.timetable,
    }
  );

  return {
    isLoading: timetable.isPending,
    periods: periods.data ?? [],
    timetable: timetable.data ?? null,
  };
}

/**
 * One substitution, expanded into one ticker row per affected lesson. Lessons
 * whose period has already ended are dropped, and a row with no substituter is
 * flagged as cancelled.
 */
function substitutionRows(item: Substitutions[number]): TvSubstitutionRow[] {
  if (!isToday(item.substitution.date)) {
    return [];
  }

  const rows: TvSubstitutionRow[] = [];

  for (const lesson of item.lessons) {
    if (!lesson) {
      continue;
    }

    const period = lesson.period;
    if (!period || isPeriodOver(period)) {
      continue;
    }

    rows.push({
      cancelled: item.teacher === null,
      className: lesson.cohorts[0] ?? '',
      classroom: lesson.classrooms[0]?.short ?? '',
      lesson: period.period,
      missing: lesson.teachers[0]?.short ?? '',
      teacher: item.teacher?.short ?? '',
    });
  }

  return rows;
}

/**
 * Today's substitutions, one row per affected lesson, in period order. Rows
 * whose period has already ended are dropped so the ticker only ever shows
 * what is still ahead of the students.
 */
export function useTvSubstitutions() {
  const query = useApiQuery<Substitutions>(
    () => api.timetable.substitutions.$get(),
    {
      queryKey: ['timetable', 'substitutions'],
      refetchInterval: REFETCH_INTERVALS.substitutions,
    }
  );

  const rows = useMemo<TvSubstitutionRow[]>(
    () =>
      (query.data ?? [])
        .flatMap(substitutionRows)
        .sort((a, b) => a.lesson - b.lesson),
    [query.data]
  );

  return { ...query, rows };
}

/** Today's room changes whose starting period has not ended yet. */
export function useRoomChanges() {
  const query = useApiQuery<MovedLessons>(
    () => api.timetable.movedLessons.$get(),
    {
      queryKey: ['timetable', 'movedLessons'],
      refetchInterval: REFETCH_INTERVALS.roomSubtitutions,
    }
  );

  const rows = useMemo<TvRoomChangeRow[]>(() => {
    const result: TvRoomChangeRow[] = [];

    for (const item of query.data ?? []) {
      if (!(item.classroom && isToday(item.movedLesson.date))) {
        continue;
      }

      if (!item.period || isPeriodOver(item.period)) {
        continue;
      }

      result.push({
        class: item.cohortNames.join('/'),
        from: item.fromRoomNames.join('/'),
        lesson: item.period.period,
        to: item.classroom.name,
      });
    }

    return result.sort((a, b) => a.lesson - b.lesson);
  }, [query.data]);

  return { ...query, rows };
}

/**
 * The announcement feed, plus the titles joined into one marquee line. Shared
 * query key, so the ticker and the takeover fetch it once.
 */
function useKioskNews() {
  const query = useApiQuery<KioskNews>(() => api.kiosk.news.$get(), {
    queryKey: ['kiosk', 'news'],
    refetchInterval: REFETCH_INTERVALS.news,
  });

  const announcements = query.data?.announcements ?? [];

  const titles: string[] = [];
  for (const announcement of announcements) {
    if (announcement.title !== null) {
      titles.push(announcement.title);
    }
  }
  const headlines = titles.join(TV_STRINGS.news.separator);

  return { ...query, announcements, headlines };
}

/**
 * What this box may present full screen: which kinds take over, and which box
 * it is. The TV page owns the heartbeat and hands the same policy to the ticker
 * and to the takeover.
 */
export type NewsTakeoverPolicy = {
  highlightedNews: boolean;
  kioskId: string;
  newsImages: boolean;
};

/**
 * The feed split for one box: the items it presents as a full-screen takeover,
 * and the marquee line of everything else. A box never shows the same news both
 * full screen and scrolling, and a featured item is shown without its title —
 * so the takeover is the image, or the body text when there is no image to
 * show. An item targeted at other boxes is left out of the takeover entirely.
 */
export function useFeaturedNews({
  highlightedNews,
  kioskId,
  newsImages,
}: NewsTakeoverPolicy) {
  const query = useKioskNews();

  const featured: KioskNewsItem[] = [];
  const titles: string[] = [];

  for (const item of query.announcements) {
    const targeted =
      item.kioskIds.length === 0 || item.kioskIds.includes(kioskId);
    const takesOverAsImage =
      targeted && newsImages && item.imageVersion !== null;
    // Without an image the takeover is the text alone, so an item with no body
    // has nothing to present and stays in the ticker.
    const takesOverAsText =
      targeted && highlightedNews && item.highlighted && item.body.length > 0;

    if (takesOverAsImage || takesOverAsText) {
      featured.push(item);
    } else if (item.title !== null) {
      titles.push(item.title);
    }
  }

  return {
    ...query,
    featured,
    headlines: titles.join(TV_STRINGS.news.separator),
  };
}

/**
 * The takeover shown in rounds: one item at a time for `dwellMs` each, then the
 * screen goes back to the ticker for `tickerMs` before the round repeats. The
 * index restarts whenever the feed's length changes, so a new announcement is
 * never skipped over; `advance` forces the next item (used when an image fails
 * to load), which ends the round early when it was the last one.
 */
export function useNewsSlideshow(
  items: KioskNewsItem[],
  { dwellMs, tickerMs }: { dwellMs: number; tickerMs: number }
): { advance: () => void; current: KioskNewsItem | null } {
  const [index, setIndex] = useState(0);
  const [isTickerTime, setIsTickerTime] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the length is the trigger, not a value the effect reads
  useEffect(() => {
    setIndex(0);
    setIsTickerTime(false);
  }, [items.length]);

  useEffect(() => {
    if (isTickerTime || items.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      if (index + 1 < items.length) {
        setIndex(index + 1);
      } else {
        setIsTickerTime(true);
      }
    }, dwellMs);

    return () => clearTimeout(timer);
  }, [dwellMs, index, isTickerTime, items.length]);

  useEffect(() => {
    if (!isTickerTime || items.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      setIndex(0);
      setIsTickerTime(false);
    }, tickerMs);

    return () => clearTimeout(timer);
  }, [isTickerTime, items.length, tickerMs]);

  const advance = () => {
    if (items.length === 0) {
      return;
    }

    if (index + 1 < items.length) {
      setIndex(index + 1);
    } else {
      setIsTickerTime(true);
    }
  };

  return {
    advance,
    current: isTickerTime ? null : (items[index] ?? null),
  };
}

export function useKioskWeather() {
  return useApiQuery<KioskWeather>(() => api.kiosk.weather.$get(), {
    queryKey: ['kiosk', 'weather'],
    refetchInterval: REFETCH_INTERVALS.weather,
  });
}

/**
 * Departure cards for the kiosk's configured groups: the API answers one entry
 * per group, in the same order, `null` when nothing is leaving from any of that
 * group's stops.
 */
export function useKioskDepartures(groups: DepartureGroup[]) {
  // The kiosk config is re-parsed on every heartbeat; keying on the serialized
  // groups keeps an unchanged schedule from refetching for a new object.
  const key = JSON.stringify(groups);

  return useApiQuery<KioskDepartures>(
    () => api.kiosk.departures.$post({ json: { groups } }),
    {
      queryKey: ['kiosk', 'departures', key],
      refetchInterval: REFETCH_INTERVALS.busDepartures,
      retry: false,
    }
  );
}
