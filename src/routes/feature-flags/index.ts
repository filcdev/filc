import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '~/database';
import { featureFlag } from '~/database/schema/feature-flag';
import { featureFlagFactory } from '~/routes/feature-flags/_factory';
import {
  invalidateFeatureFlagCache,
  notifyFeatureFlagChange,
} from '~/utils/feature-flag';
import type { SuccessResponse } from '~/utils/globals';
import {
  requireAuthentication,
  requireAuthorization,
} from '~/utils/middleware';

export const listFeatureFlags = featureFlagFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('feature-flags:read'),
  async (c) => {
    const flags = await db
      .select({
        id: featureFlag.id,
        name: featureFlag.name,
        description: featureFlag.description,
        isEnabled: featureFlag.isEnabled,
        createdAt: featureFlag.createdAt,
        updatedAt: featureFlag.updatedAt,
      })
      .from(featureFlag);

    return c.json<SuccessResponse<typeof flags>>({
      success: true,
      data: flags,
    });
  }
);

const featureFlagQuerySchema = z.object({
  name: z.string().min(1),
});

export const getFeatureFlag = featureFlagFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('feature-flags:read'),
  zValidator('param', featureFlagQuerySchema),
  async (c) => {
    const { name } = c.req.valid('param');
    const [flag] = await db
      .select({
        id: featureFlag.id,
        name: featureFlag.name,
        description: featureFlag.description,
        isEnabled: featureFlag.isEnabled,
        createdAt: featureFlag.createdAt,
        updatedAt: featureFlag.updatedAt,
      })
      .from(featureFlag)
      .where(eq(featureFlag.name, name))
      .limit(1);

    if (!flag) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Feature flag not found',
      });
    }

    return c.json<SuccessResponse<typeof flag>>({
      success: true,
      data: flag,
    });
  }
);

const featureFlagToggleBodySchema = z.object({
  isEnabled: z.boolean(),
});

export const toggleFeatureFlag = featureFlagFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('feature-flags:write'),
  zValidator('json', featureFlagToggleBodySchema),
  async (c) => {
    const name = c.req.param('name');
    if (!name) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Feature flag name is required',
      });
    }
    const { isEnabled } = c.req.valid('json');
    const [existing] = await db
      .select({ id: featureFlag.id })
      .from(featureFlag)
      .where(eq(featureFlag.name, name))
      .limit(1);

    if (!existing) {
      throw new HTTPException(StatusCodes.NOT_FOUND, {
        message: 'Feature flag not found',
      });
    }

    const [updated] = await db
      .update(featureFlag)
      .set({ isEnabled })
      .where(eq(featureFlag.name, name))
      .returning({
        id: featureFlag.id,
        name: featureFlag.name,
        description: featureFlag.description,
        isEnabled: featureFlag.isEnabled,
        createdAt: featureFlag.createdAt,
        updatedAt: featureFlag.updatedAt,
      });

    if (!updated) {
      throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: 'Failed to update feature flag',
      });
    }

    // Invalidate cache and notify handlers
    invalidateFeatureFlagCache(name);
    await notifyFeatureFlagChange(name, isEnabled);

    return c.json<SuccessResponse<typeof updated>>({
      success: true,
      data: updated,
    });
  }
);
