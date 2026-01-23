import { createFactory } from 'hono/factory';
import type { Context } from '#_types/globals';
import { ping } from '#routes/ping/index';
import { uptime } from '#routes/ping/uptime';

export const pingFactory = createFactory<Context>();
export const pingRouter = pingFactory
  .createApp()
  .get('/', ...ping)
  .get('/uptime', ...uptime);
