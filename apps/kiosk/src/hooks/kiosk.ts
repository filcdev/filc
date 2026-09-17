import {
  DEFAULT_IDLE_RESET_SECONDS,
  DEFAULT_PETRIK_NEWS_DWELL_SECONDS,
  DEFAULT_PETRIK_NEWS_ENABLED,
  DEFAULT_PETRIK_NEWS_FEED_URL,
  DEFAULT_PETRIK_NEWS_IDLE_SECONDS,
  DEFAULT_PETRIK_NEWS_MAX_ITEMS,
  type NavigatorKioskConfig,
  navigatorKioskConfigSchema,
  type TvKioskConfig,
  tvKioskConfigSchema,
} from '@filcdev/api/domains/kiosk/config';
import { useMemo } from 'react';
import { api, useApiQuery } from '@/utils/api';
import {
  DEFAULT_NEWS_SLIDE_SECONDS,
  DEFAULT_NEWS_TICKER_SECONDS,
  HEARTBEAT_INTERVAL,
} from '@/utils/constants';
import { APP_VERSION } from '@/utils/version';

/** What Chronos knows about this box. */
export type KioskIdentity = { id: string; kind: string; name: string };

/**
 * The three heartbeat answers. Hand-written rather than inferred from the
 * router: the route always replies 200, so the client type of a handler that
 * branches on registration collapses to its first branch and the discriminator
 * is lost.
 */
type HeartbeatResponse =
  | { registered: false }
  | { enabled: false; kiosk: KioskIdentity; registered: true }
  | {
      enabled: true;
      kiosk: KioskIdentity & { config: unknown };
      registered: true;
    };

/**
 * The heartbeat collapsed into the states the box can be in. `config` is only
 * present once the box is registered, enabled and its blob parsed.
 */
export type KioskStatus =
  | { state: 'unknown' }
  | { state: 'disabled'; kiosk: KioskIdentity }
  | { config: TvKioskConfig; kiosk: KioskIdentity; state: 'tv' }
  | { config: NavigatorKioskConfig; kiosk: KioskIdentity; state: 'navigator' };

/**
 * A kiosk row whose stored config does not parse must not take the box down:
 * the heartbeat still proves the box is alive, so fall back to the defaults and
 * let the admin fix the config in Iris.
 */
function normalizeHeartbeat(raw: HeartbeatResponse): KioskStatus {
  if (!raw.registered) {
    return { state: 'unknown' };
  }

  const kiosk = raw.kiosk;

  if (!raw.enabled) {
    return { kiosk, state: 'disabled' };
  }

  if (kiosk.kind === 'tv') {
    const parsed = tvKioskConfigSchema.safeParse(raw.kiosk.config);
    return {
      // The schema's defaults make the parsed news keys required, so the
      // failure path has to spell out the same values explicitly.
      config: parsed.success
        ? parsed.data
        : {
            departures: [],
            highlightedNews: true,
            newsImages: true,
            newsSlideSeconds: DEFAULT_NEWS_SLIDE_SECONDS,
            newsTickerSeconds: DEFAULT_NEWS_TICKER_SECONDS,
          },
      kiosk,
      state: 'tv',
    };
  }

  const parsed = navigatorKioskConfigSchema.safeParse(raw.kiosk.config);
  return {
    config: parsed.success
      ? parsed.data
      : {
          idleResetSeconds: DEFAULT_IDLE_RESET_SECONDS,
          petrikNewsDwellSeconds: DEFAULT_PETRIK_NEWS_DWELL_SECONDS,
          petrikNewsEnabled: DEFAULT_PETRIK_NEWS_ENABLED,
          petrikNewsFeedUrl: DEFAULT_PETRIK_NEWS_FEED_URL,
          petrikNewsIdleSeconds: DEFAULT_PETRIK_NEWS_IDLE_SECONDS,
          petrikNewsMaxItems: DEFAULT_PETRIK_NEWS_MAX_ITEMS,
          startLocation: null,
        },
    kiosk,
    state: 'navigator',
  };
}

/**
 * Tells Chronos this box is alive and reads back what it should show. Polls
 * forever: enrolling or re-enabling a box in Iris reaches it without a restart,
 * and the same query feeds every screen that needs the config.
 *
 * Returns `undefined` while the first answer is still in flight or after a
 * failed request — both mean "this box is not known to be usable yet".
 */
export function useKioskHeartbeat(machineId: string): KioskStatus | undefined {
  const query = useApiQuery<HeartbeatResponse>(
    () =>
      api.kiosk.heartbeat.$post({
        json: { appVersion: APP_VERSION, machineId },
      }),
    {
      queryKey: ['kiosk', 'heartbeat', machineId],
      refetchInterval: HEARTBEAT_INTERVAL,
      retry: 2,
    }
  );

  // Memoize on the stable React Query data reference (structural sharing keeps
  // it referentially equal across re-renders and equal refetches) so the
  // normalized `config`/`startLocation` are reference-stable. Downstream memos
  // (the path builder and the 3D sync effect) key off that identity and would
  // otherwise recompute on every unrelated render.
  return useMemo(
    () => (query.data ? normalizeHeartbeat(query.data) : undefined),
    [query.data]
  );
}
