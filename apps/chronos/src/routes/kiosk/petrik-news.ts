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
  parseFeaturedImages,
  parsePetrikNewsFeed,
  stripTrailingSlash,
} from '#utils/kiosk/petrik-news';
import { kioskPetrikNewsResponseSchema } from '#utils/kiosk/schemas';
import { filcExt } from '#utils/openapi';
import { kioskFactory } from './_factory';

const PETRIK_NEWS_CACHE_TTL_MS = 10 * 60 * 1000;
const PETRIK_NEWS_TIMEOUT_MS = 10_000;
const MAX_FEED_BYTES = 1_048_576;
const MAX_JSON_BYTES = 4 * 1024 * 1024;

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
 * Read a response body up to a hard size cap, decoding as UTF-8. A null body
 * or a body over the cap throws; callers decide whether that is fatal (the
 * feed, wrapped into a 502) or best-effort (the REST fallback).
 */
async function readCappedText(
  response: Response,
  maxBytes: number
): Promise<string> {
  if (!response.body) {
    throw new Error('petrik.hu returned an empty body');
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
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('petrik.hu response is too large');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
  chunks.push(decoder.decode());
  return chunks.join('');
}

/**
 * Fetch featured images from the WordPress REST API at the feed's own origin.
 * petrik.hu's RSS carries no featured image, so `wp/v2/posts` is the primary
 * picture source — a post's banner replaces its first in-body `<img>` as the
 * default. The REST host is the feed's own origin, already validated by
 * `assertAllowedFeedUrl`. A non-ok response means "no featured images
 * available", leaving the in-body fallback in place.
 */
async function fetchFeaturedImages(
  feedUrl: string
): Promise<Map<string, string>> {
  const restUrl = new URL('/wp-json/wp/v2/posts', feedUrl);
  restUrl.searchParams.set('per_page', '100');
  restUrl.searchParams.set('_embed', 'wp:featuredmedia');
  // `_fields` is deliberately omitted: WordPress drops `_embedded` whenever
  // `_fields` is set, so restricting fields would strip the `source_url` the
  // fallback needs. The uncapped response is bounded by `MAX_JSON_BYTES`.

  const response = await fetch(restUrl, {
    headers: { 'user-agent': 'filc-kiosk/1.0 (+https://filc.petrik.hu)' },
    redirect: 'manual',
    signal: AbortSignal.timeout(PETRIK_NEWS_TIMEOUT_MS),
  });

  if (!response.ok) {
    return new Map();
  }

  return parseFeaturedImages(
    JSON.parse(await readCappedText(response, MAX_JSON_BYTES))
  );
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

      xml = await readCappedText(response, MAX_FEED_BYTES);
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

    // petrik.hu's feed never exposes the featured image, so resolve the
    // WordPress REST featured map and apply it as the primary picture; a post
    // with no featured image (featured_media: 0) keeps its first in-body
    // `<img>` as the fallback. This is best-effort: a failed lookup leaves the
    // parsed items (and their in-body images) untouched.
    if (items.length > 0) {
      try {
        const featured = await fetchFeaturedImages(feed.feedUrl);
        for (const item of items) {
          item.imageUrl =
            featured.get(stripTrailingSlash(item.url)) ?? item.imageUrl;
        }
      } catch {
        // Best-effort fallback; keep the parsed items as-is on any failure.
      }
    }

    feedCache.set(feed.feedUrl, {
      expiresAt: Date.now() + PETRIK_NEWS_CACHE_TTL_MS,
      items,
    });

    return ok(c, { items: items.slice(0, feed.maxItems) });
  }
);
