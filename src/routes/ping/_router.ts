import { Hono } from 'hono';
import { ping } from '~/routes/ping/index';
import { uptime } from '~/routes/ping/uptime';
import type { honoContext } from '~/utils/globals';

export const pingRouter = new Hono<honoContext>();

pingRouter.get('/', ...ping);
pingRouter.get('/uptime', ...uptime);
