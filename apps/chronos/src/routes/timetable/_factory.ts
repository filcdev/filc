import { createFactory } from 'hono/factory';
import type { AuthenticatedContext } from '#_types/globals';

export const timetableFactory = createFactory<AuthenticatedContext>();
