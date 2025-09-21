import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '~/database';
import { featureFlag } from '~/database/schema/feature-flag';
import { featureFlagFactory } from '~/routes/feature-flags/_factory';
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

    return c.json<SuccessResponse>({
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

    return c.json<SuccessResponse>({
      success: true,
      data: flag,
    });
  }
);

const featureFlagToggleSchema = z.object({
  name: z.string().min(1),
  isEnabled: z.boolean(),
});

export const toggleFeatureFlag = featureFlagFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('feature-flags:write'),
  zValidator('param', featureFlagToggleSchema),
  async (c) => {
    const { name, isEnabled } = c.req.valid('param');
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

    return c.json<SuccessResponse>({
      success: true,
      data: updated,
    });
  }
);
