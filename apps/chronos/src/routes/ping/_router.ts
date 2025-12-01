import { pingFactory } from '@/routes/ping/_factory';
import { ping } from '@/routes/ping/index';
import { uptime } from '@/routes/ping/uptime';

export const pingRouter = pingFactory
  .createApp()
  .get('/', ...ping)
  .get('/uptime', ...uptime);
