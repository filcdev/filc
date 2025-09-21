import { Hono } from 'hono';
import {
  getFeatureFlag,
  listFeatureFlags,
  toggleFeatureFlag,
} from '~/routes/feature-flags';
import type { Context } from '~/utils/globals';

export const featureFlagRouter = new Hono<Context>();

featureFlagRouter.get('/', ...listFeatureFlags);
featureFlagRouter.get('/:name', ...getFeatureFlag);
featureFlagRouter.post('/:name', ...toggleFeatureFlag);
