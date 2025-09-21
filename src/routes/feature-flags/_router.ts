import { Hono } from 'hono';
import {
  getFeatureFlag,
  listFeatureFlags,
  toggleFeatureFlag,
} from '~/routes/feature-flags';
import type { Context } from '~/utils/globals';

export const featureFlagRouter = new Hono<Context>()
  .get('/', ...listFeatureFlags)
  .get('/:name', ...getFeatureFlag)
  .post('/:name', ...toggleFeatureFlag);
