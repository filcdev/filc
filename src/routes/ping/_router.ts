import { Hono } from 'hono';
import { ping } from '~/routes/ping/index';
import { uptime } from '~/routes/ping/uptime';
import type { Context } from '~/utils/globals';

export const pingRouter = new Hono<Context>()
  .get('/', ...ping)
  .get('/uptime', ...uptime);
