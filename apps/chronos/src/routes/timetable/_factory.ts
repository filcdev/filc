import { createFactory } from 'hono/factory';
import type { AuthenticatedContext } from '#utils/types/globals';

export const timetableFactory = createFactory<AuthenticatedContext>();
