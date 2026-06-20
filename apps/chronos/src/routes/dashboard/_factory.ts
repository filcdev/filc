import { createFactory } from 'hono/factory';
import type { Context } from '#_types/globals';

export const dashboardFactory = createFactory<Context>();
