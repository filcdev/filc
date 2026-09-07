import { createFactory } from 'hono/factory';
import type { Context } from '#_types/globals';

export const navigatorFactory = createFactory<Context>();

export const navigatorIdPathParam = {
  in: 'path',
  name: 'id',
  required: true,
  schema: { format: 'uuid', type: 'string' },
} as const;
