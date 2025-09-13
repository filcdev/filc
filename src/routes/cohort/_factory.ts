import { createFactory } from 'hono/factory';
import type { honoContext } from '~/utils/globals';

export const cohortFactory = createFactory<honoContext>();
