import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import z from 'zod';
import { db } from '~/database';
import { featureFlag } from '~/database/schema/feature-flag';
import { featureFlagFactory } from '~/routes/feature-flags/_factory';
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

    return c.json({ flags });
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
      return c.json({ error: 'Feature flag not found' }, StatusCodes.NOT_FOUND);
    }

    return c.json({ flag });
  }
);

export const enableFeatureFlag = featureFlagFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('feature-flags:write'),
  zValidator('param', featureFlagQuerySchema),
  async (c) => {
    const { name } = c.req.valid('param');
    const [existing] = await db
      .select({ id: featureFlag.id })
      .from(featureFlag)
      .where(eq(featureFlag.name, name))
      .limit(1);

    if (!existing) {
      return c.json({ error: 'Feature flag not found' }, StatusCodes.NOT_FOUND);
    }

    const [updated] = await db
      .update(featureFlag)
      .set({ isEnabled: true })
      .where(eq(featureFlag.name, name))
      .returning({
        id: featureFlag.id,
        name: featureFlag.name,
        description: featureFlag.description,
        isEnabled: featureFlag.isEnabled,
        createdAt: featureFlag.createdAt,
        updatedAt: featureFlag.updatedAt,
      });

    return c.json({ flag: updated });
  }
);

export const disableFeatureFlag = featureFlagFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('feature-flags:write'),
  zValidator('param', featureFlagQuerySchema),
  async (c) => {
    const { name } = c.req.valid('param');
    const [existing] = await db
      .select({ id: featureFlag.id })
      .from(featureFlag)
      .where(eq(featureFlag.name, name))
      .limit(1);

    if (!existing) {
      return c.json({ error: 'Feature flag not found' }, StatusCodes.NOT_FOUND);
    }

    const [updated] = await db
      .update(featureFlag)
      .set({ isEnabled: false })
      .where(eq(featureFlag.name, name))
      .returning({
        id: featureFlag.id,
        name: featureFlag.name,
        description: featureFlag.description,
        isEnabled: featureFlag.isEnabled,
        createdAt: featureFlag.createdAt,
        updatedAt: featureFlag.updatedAt,
      });

    return c.json({ flag: updated });
  }
);
