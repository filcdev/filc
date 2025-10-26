import {
  getFeatureFlag,
  listFeatureFlags,
  toggleFeatureFlag,
} from '~/routes/feature-flags';
import { featureFlagFactory } from '~/routes/feature-flags/_factory';

export const featureFlagRouter = featureFlagFactory
  .createApp()
  .get('/', ...listFeatureFlags)
  .get('/:name', ...getFeatureFlag)
  .post('/:name', ...toggleFeatureFlag);
