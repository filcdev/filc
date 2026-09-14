import { kioskDeparturesRequestSchema } from '@filcdev/api/domains/kiosk/config';
import { zValidator } from '@hono/zod-validator';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import { env } from '#utils/environment';
import { ApiHttpError, ok } from '#utils/http';
import { kioskDeparturesResponseSchema } from '#utils/kiosk/schemas';
import { filcExt } from '#utils/openapi';
import { kioskFactory } from './_factory';

const BKK_URL =
  'https://futar.bkk.hu/api/query/v1/ws/otp/api/where/arrivals-and-departures-for-stop';
const DEPARTURES_CACHE_TTL_MS = 30_000;
const BKK_TIMEOUT_MS = 10_000;

type BkkStopTime = {
  departureTime: number;
  predictedDepartureTime?: number | null;
  tripId: string;
};

type BkkResponse = {
  data?: {
    entry?: { stopTimes?: BkkStopTime[] };
    references?: {
      routes?: Record<string, { shortName: string }>;
      trips?: Record<string, { id?: string; routeId?: string }>;
    };
  };
};

type Departure = {
  predictedDepartureTime: number;
  routeShortDesc: string;
};

const departuresCache = new Map<
  string,
  { expiresAt: number; value: Departure | null }
>();

const { schema: departuresRequestSchema } = await resolver(
  kioskDeparturesRequestSchema
).toOpenAPISchema();

type BkkReferences = NonNullable<BkkResponse['data']>['references'];

const toDeparture = (
  stopTime: BkkStopTime,
  routeShortDesc: string
): Departure => ({
  predictedDepartureTime:
    stopTime.predictedDepartureTime || stopTime.departureTime,
  routeShortDesc,
});

/** First stop time of a trip restricted to `routeFilter`, if any. */
function filteredDeparture(
  stopTimes: BkkStopTime[],
  references: BkkReferences,
  routeFilter: string
): Departure | null {
  // The reference map is keyed by trip id, which is what stop times carry.
  const matchingTripIds = new Set(
    Object.entries(references?.trips ?? {})
      .filter(([, trip]) => trip.routeId === routeFilter)
      .map(([tripId]) => tripId)
  );

  const stopTime = stopTimes.find((candidate) =>
    matchingTripIds.has(candidate.tripId)
  );
  const routeShortDesc = references?.routes?.[routeFilter]?.shortName;

  return stopTime && routeShortDesc
    ? toDeparture(stopTime, routeShortDesc)
    : null;
}

/** First stop time overall, labelled with its route's short name. */
function nextDeparture(
  stopTimes: BkkStopTime[],
  references: BkkReferences
): Departure | null {
  const stopTime = stopTimes[0];
  const routeId = stopTime
    ? references?.trips?.[stopTime.tripId]?.routeId
    : undefined;
  const routeShortDesc = routeId
    ? references?.routes?.[routeId]?.shortName
    : undefined;

  return stopTime && routeShortDesc
    ? toDeparture(stopTime, routeShortDesc)
    : null;
}

/**
 * Fetch the next departure from one stop, optionally restricted to a single
 * route. Mirrors the PetrikTV client: pick the first stop time of a trip whose
 * route matches the filter, otherwise the first stop time overall.
 */
async function fetchDeparturesForStop(
  stopId: string,
  routeFilter: string | null
): Promise<Departure | null> {
  try {
    const url = new URL(BKK_URL);
    url.searchParams.set('key', env.bkkApiKey ?? '');
    url.searchParams.set('stopId', stopId);
    url.searchParams.set('minutesBefore', '0');
    url.searchParams.set('minutesAfter', '30');

    const response = await fetch(url, {
      signal: AbortSignal.timeout(BKK_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as BkkResponse;
    const stopTimes = body.data?.entry?.stopTimes;

    if (!stopTimes || stopTimes.length === 0) {
      return null;
    }

    return routeFilter
      ? filteredDeparture(stopTimes, body.data?.references, routeFilter)
      : nextDeparture(stopTimes, body.data?.references);
  } catch {
    return null;
  }
}

/** Same lookup as `fetchDeparturesForStop`, served from a 30s per-stop cache. */
async function getDeparturesForStop(
  stopId: string,
  routeFilter: string | null
): Promise<Departure | null> {
  const cacheKey = `${stopId}:${routeFilter ?? ''}`;
  const cached = departuresCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await fetchDeparturesForStop(stopId, routeFilter);
  departuresCache.set(cacheKey, {
    expiresAt: Date.now() + DEPARTURES_CACHE_TTL_MS,
    value,
  });

  return value;
}

export const kioskDeparturesRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt(
      'Kiosk',
      '@unit KioskDeparturesResponse @field(.departures, List<KioskDeparture>)'
    ),
    description:
      'Next departure per configured group, trying each stop in order',
    requestBody: {
      content: {
        'application/json': {
          schema: departuresRequestSchema,
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(kioskDeparturesResponseSchema),
          },
        },
        description: 'Successful Response',
      },
      502: { description: 'BKK Futár unavailable or unconfigured' },
    },
    tags: ['Kiosk'],
  }),
  zValidator('json', kioskDeparturesRequestSchema),
  async (c) => {
    if (!env.bkkApiKey) {
      throw new ApiHttpError(StatusCodes.BAD_GATEWAY, {
        message: 'BKK API key is not configured',
      });
    }

    const { groups } = c.req.valid('json');

    const departures = await Promise.all(
      groups.map(async (group) => {
        for (const stop of group.stops) {
          const departure = await getDeparturesForStop(
            stop.stopId,
            stop.routeFilter
          );

          if (departure) {
            return { label: group.label, ...departure };
          }
        }

        return null;
      })
    );

    return ok(c, { departures });
  }
);
