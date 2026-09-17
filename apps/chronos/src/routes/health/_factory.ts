import { createFactory } from 'hono/factory';
import type { Context } from '#_types/globals';

export const healthFactory = createFactory<Context>();
