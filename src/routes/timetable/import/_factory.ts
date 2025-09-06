import { createFactory } from 'hono/factory';
import type { authenticatedContext } from '~/utils/globals';

export const importFactory = createFactory<authenticatedContext>();
