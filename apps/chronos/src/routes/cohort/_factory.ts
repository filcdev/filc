import { createFactory } from 'hono/factory';
import type { Context } from '#utils/types/globals';

export const cohortFactory = createFactory<Context>();
