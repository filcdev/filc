import { createFactory } from 'hono/factory';
import type { AuthenticatedContext } from '~/utils/globals';

export const doorlockFactory = createFactory<AuthenticatedContext>();
