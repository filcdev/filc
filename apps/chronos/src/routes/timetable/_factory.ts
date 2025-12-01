import { createFactory } from 'hono/factory';
import type { AuthenticatedContext } from '#utils/globals';

export const timetableFactory = createFactory<AuthenticatedContext>();
