import { Hono } from 'hono';
import { importRouter } from '~/routes/timetable/import/_router';
import type { honoContext } from '~/utils/globals';

export const timetableRouter = new Hono<honoContext>();

timetableRouter.route('/import', importRouter);
