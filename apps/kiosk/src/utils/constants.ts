/** How often each ticker widget refreshes, in milliseconds. */
export const REFETCH_INTERVALS = {
  busDepartures: 30 * 1000,
  navigatorGraph: 5 * 60 * 1000,
  news: 2 * 60 * 1000,
  roomSubtitutions: 60 * 1000,
  substitutions: 30 * 1000,
  timetable: 5 * 60 * 1000,
  weather: 10 * 60 * 1000,
} as const;

/** How often the box tells Chronos it is alive. */
export const HEARTBEAT_INTERVAL = 30 * 1000;

/** Fallback dwell for the news takeover, in seconds, when a config omits one. */
export const DEFAULT_NEWS_SLIDE_SECONDS = 20;

/** Fallback board interval between takeover rounds, in seconds. */
export const DEFAULT_NEWS_TICKER_SECONDS = 60;

export const TABLE = {
  cycleInterval: 5000,
  roomSubstitutions: {
    pageSize: 3,
  },
  substitutions: {
    pageSize: 6,
  },
} as const;
