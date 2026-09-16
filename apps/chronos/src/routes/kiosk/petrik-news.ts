import {
  DEFAULT_PETRIK_NEWS_FEED_URL,
  DEFAULT_PETRIK_NEWS_MAX_ITEMS,
  navigatorKioskConfigSchema,
} from '@filcdev/api/domains/kiosk/config';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '#database';
import { kiosk } from '#database/schema/kiosk';
import { ApiHttpError, ok } from '#utils/http';
import { assertAllowedFeedUrl } from '#utils/kiosk/feed-url';
import {
  type PetrikNewsItem,
  parsePetrikNewsFeed,
} from '#utils/kiosk/petrik-news';
import { kioskPetrikNewsResponseSchema } from '#utils/kiosk/schemas';
import { filcExt } from '#utils/openapi';
import { kioskFactory } from './_factory';

const PETRIK_NEWS_CACHE_TTL_MS = 10 * 60 * 1000;
const PETRIK_NEWS_TIMEOUT_MS = 10_000;
const MAX_FEED_BYTES = 1_048_576;

const petrikNewsQuerySchema = z.object({
  machine: z.string().min(1).optional(),
});

/**
 * Per-URL cache: each resolved feed URL has its own ten-minute TTL. The feed
 * URL is resolved from the kiosk's own stored config, never from the client,
 * so this public endpoint cannot be used as an open fetch proxy.
 */
const feedCache = new Map<
  string,
  { expiresAt: number; items: PetrikNewsItem[] }
>();

/**
 * Read the feed body up to a hard size cap, decoding as UTF-8. A null body or
 * a body over the cap is an unusable feed and surfaces as a 502.
 */
async function readFeedBody(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error('petrik.hu feed returned an empty body');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_FEED_BYTES) {
        await reader.cancel();
        throw new ApiHttpError(StatusCodes.BAD_GATEWAY, {
          message: 'petrik.hu feed is too large',
        });
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
  chunks.push(decoder.decode());
  return chunks.join('');
}

type ResolvedFeed = {
  enabled: boolean;
  feedUrl: string;
  maxItems: number;
};

/**
 * Resolve a machine's stored feed URL, item cap and enable flag, falling back
 * to the default feed when the machine is unknown or its config does not
 * parse. A disabled takeover still resolves, so the handler can short-circuit.
 */
async function resolveFeed(machine: string | undefined): Promise<ResolvedFeed> {
  let enabled = true;
  let feedUrl = DEFAULT_PETRIK_NEWS_FEED_URL;
  let maxItems = DEFAULT_PETRIK_NEWS_MAX_ITEMS;

  if (machine) {
    const [row] = await db
      .select()
      .from(kiosk)
      .where(eq(kiosk.machineId, machine));
    if (row) {
      const parsed = navigatorKioskConfigSchema.safeParse(row.config);
      if (parsed.success) {
        enabled = parsed.data.petrikNewsEnabled;
        feedUrl = parsed.data.petrikNewsFeedUrl;
        maxItems = parsed.data.petrikNewsMaxItems;
      }
    }
  }

  return { enabled, feedUrl, maxItems };
}

export const kioskPetrikNewsRoute = kioskFactory.createHandlers(
  describeRoute({
    ...filcExt('Kiosk', '@unit KioskPetrikNewsResponse'),
    description:
      'petrik.hu news for the navigator kiosk, cached for ten minutes',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(kioskPetrikNewsResponseSchema),
          },
        },
        description: 'Successful Response',
      },
      502: { description: 'petrik.hu feed unavailable' },
    },
    tags: ['Kiosk'],
  }),
  zValidator('query', petrikNewsQuerySchema),
  async (c) => {
    const { machine } = c.req.valid('query');
    const feed = await resolveFeed(machine);

    if (!feed.enabled) {
      return ok(c, { items: [] });
    }

    // Serve the cache without a DNS round-trip; only a miss reaches the SSRF
    // guard, so a warm cache never pays for `assertAllowedFeedUrl`.
    const cached = feedCache.get(feed.feedUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return ok(c, { items: cached.items.slice(0, feed.maxItems) });
    }

    await assertAllowedFeedUrl(feed.feedUrl);

    let xml: string;
    try {
      const response = await fetch(feed.feedUrl, {
        headers: { 'user-agent': 'filc-kiosk/1.0 (+https://filc.petrik.hu)' },
        redirect: 'manual',
        signal: AbortSignal.timeout(PETRIK_NEWS_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`petrik.hu responded with ${response.status}`);
      }

      xml = await readFeedBody(response);
    } catch (error) {
      if (error instanceof ApiHttpError) {
        throw error;
      }
      throw new ApiHttpError(StatusCodes.BAD_GATEWAY, {
        cause: error,
        message: 'Failed to fetch petrik.hu news',
      });
    }

    const items = parsePetrikNewsFeed(xml);

    feedCache.set(feed.feedUrl, {
      expiresAt: Date.now() + PETRIK_NEWS_CACHE_TTL_MS,
      items,
    });

    return ok(c, { items: items.slice(0, feed.maxItems) });
  }
);
