import { Hono } from 'hono';
import {
  disableFeatureFlag,
  enableFeatureFlag,
  getFeatureFlag,
  listFeatureFlags,
} from '~/routes/feature-flags';
import type { honoContext } from '~/utils/globals';

export const featureFlagRouter = new Hono<honoContext>();

featureFlagRouter.get('/', ...listFeatureFlags);
featureFlagRouter.get('/:name', ...getFeatureFlag);
featureFlagRouter.post('/:name/enable', ...enableFeatureFlag);
featureFlagRouter.post('/:name/disable', ...disableFeatureFlag);
