import { Hono } from 'hono';
import { importRoute } from '~/routes/timetable/import';
import type { honoContext } from '~/utils/globals';

export const timetableRouter = new Hono<honoContext>();

timetableRouter.post('/import', ...importRoute);
