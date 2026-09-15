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
import {
  type PetrikNewsItem,
  parsePetrikNewsFeed,
} from '#utils/kiosk/petrik-news';
import { kioskPetrikNewsResponseSchema } from '#utils/kiosk/schemas';
import { filcExt } from '#utils/openapi';
import { kioskFactory } from './_factory';

const PETRIK_NEWS_CACHE_TTL_MS = 10 * 60 * 1000;
const PETRIK_NEWS_TIMEOUT_MS = 10_000;

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
          feedUrl = parsed.data.petrikNewsFeedUrl;
          maxItems = parsed.data.petrikNewsMaxItems;
        }
      }
    }

    const cached = feedCache.get(feedUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return ok(c, { items: cached.items.slice(0, maxItems) });
    }

    let xml: string;
    try {
      const response = await fetch(feedUrl, {
        headers: { 'user-agent': 'filc-kiosk/1.0 (+https://filc.petrik.hu)' },
        signal: AbortSignal.timeout(PETRIK_NEWS_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`petrik.hu responded with ${response.status}`);
      }

      xml = await response.text();
    } catch (error) {
      throw new ApiHttpError(StatusCodes.BAD_GATEWAY, {
        cause: error,
        message: 'Failed to fetch petrik.hu news',
      });
    }

    const items = parsePetrikNewsFeed(xml);

    feedCache.set(feedUrl, {
      expiresAt: Date.now() + PETRIK_NEWS_CACHE_TTL_MS,
      items,
    });

    return ok(c, { items: items.slice(0, maxItems) });
  }
);
