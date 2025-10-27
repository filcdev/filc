import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { db } from '~/database';
import { featureFlag } from '~/database/schema/feature-flag';

const logger = getLogger(['chronos', 'feature-flag']);

type CachedFlag = {
  value: boolean;
  lastFetched: number;
};

const CACHE_TTL_MS = 5000; // 5 seconds cache
const flagCache = new Map<string, CachedFlag>();

type FeatureFlagHandler = {
  onEnable?: () => void | Promise<void>;
  onDisable?: () => void | Promise<void>;
};

const flagHandlers = new Map<string, FeatureFlagHandler>();

/**
 * Register a feature flag with optional callbacks for enable/disable events.
 * The flag will be created in the database if it doesn't exist.
 * Returns the current state of the flag (with caching).
 */
export const handleFeatureFlag = async (
  name: string,
  description: string,
  defaultEnabled: boolean,
  handlers?: FeatureFlagHandler
): Promise<boolean> => {
  // Register handlers if provided
  if (handlers !== undefined) {
    flagHandlers.set(name, handlers);
  }

  // Check cache first
  const cached = flagCache.get(name);
  const now = Date.now();
  if (cached && now - cached.lastFetched < CACHE_TTL_MS) {
    return cached.value;
  }

  // Fetch from database
  const [existingFlag] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.name, name));

  if (!existingFlag) {
    logger.debug(
      `Registering feature flag: ${name} - ${description} (default: ${defaultEnabled})`
    );
    await db
      .insert(featureFlag)
      .values({ description, isEnabled: defaultEnabled, name })
      .returning();

    // Cache the default value
    flagCache.set(name, { lastFetched: now, value: defaultEnabled });
    return defaultEnabled;
  }

  // Update cache
  flagCache.set(name, { lastFetched: now, value: existingFlag.isEnabled });
  return existingFlag.isEnabled;
};

/**
 * Get the current state of a feature flag (cached).
 * This is a lightweight check that uses the cache.
 */
export const isFeatureEnabled = async (name: string): Promise<boolean> => {
  const cached = flagCache.get(name);
  const now = Date.now();

  // Return cached value if still valid
  if (cached && now - cached.lastFetched < CACHE_TTL_MS) {
    return cached.value;
  }

  // Refresh cache from database
  const [flag] = await db
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.name, name));

  if (!flag) {
    return false;
  }

  flagCache.set(name, { lastFetched: now, value: flag.isEnabled });
  return flag.isEnabled;
};

/**
 * Invalidate the cache for a specific flag or all flags.
 * Call this after toggling a flag to force immediate refresh.
 */
export const invalidateFeatureFlagCache = (name?: string) => {
  if (name) {
    flagCache.delete(name);
  } else {
    flagCache.clear();
  }
};

/**
 * Notify handlers when a flag is toggled.
 * This should be called by the toggle endpoint.
 */
export const notifyFeatureFlagChange = async (
  name: string,
  isEnabled: boolean
) => {
  const handler = flagHandlers.get(name);
  if (!handler) {
    return;
  }

  try {
    if (isEnabled && handler.onEnable) {
      await handler.onEnable();
      logger.info(`Feature flag ${name} enabled - handler executed`);
    } else if (!isEnabled && handler.onDisable) {
      await handler.onDisable();
      logger.info(`Feature flag ${name} disabled - handler executed`);
    }
  } catch (err) {
    logger.error(`Error executing handler for feature flag ${name}`, {
      error: String(err),
    });
  }
};
