import { createFactory } from 'hono/factory';
import type { Context } from '~/utils/globals';

export const featureFlagFactory = createFactory<Context>();
