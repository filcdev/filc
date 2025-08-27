import { Hono } from 'hono';
import { introspect } from '~/routes/_dev/introspect';
import type { honoContext } from '~/utils/globals';

export const developmentRouter = new Hono<honoContext>();

developmentRouter.get('/introspect', ...introspect);
