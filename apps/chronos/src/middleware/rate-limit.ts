import { getLogger } from '@logtape/logtape';
import { MemoryRatelimiter } from '@orpc/experimental-ratelimit/memory';
import { base } from '#orpc';
import { env } from '#utils/environment';

const logger = getLogger(['chronos', 'server']);

// Per-process, exactly like the pre-migration limiter it replaces: a single
// instance keeps identical behaviour, replicas would need a shared store.
const limiter = new MemoryRatelimiter({
  maxRequests: env.rateLimitMax,
  window: env.rateLimitWindowMs,
});

/** `reset` is an absolute Unix timestamp in milliseconds. */
const retryAfterSeconds = (reset: number | undefined) =>
  Math.max(1, Math.ceil(((reset ?? Date.now()) - Date.now()) / 1000));

/**
 * Keys the limiter on the caller (`session.id` ?? `anonymousId` ?? `'unknown'`)
 * plus the client IP, mirroring the pre-migration key generator.
 */
export const rateLimit = base.middleware(async ({ context, errors, next }) => {
  const key = `${context.session?.id ?? context.anonymousId ?? 'unknown'}|${context.clientIp}`;
  const result = await limiter.limit(key);

  if (!result.success) {
    logger.debug(`Rate limit exceeded for ${key}`);
    throw errors.RATE_LIMITED({
      data: { retryAfter: retryAfterSeconds(result.reset) },
      message: 'Too many requests',
    });
  }

  return next();
});
