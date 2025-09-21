import { Hono } from 'hono';
import { introspect } from '~/routes/_dev/introspect';
import type { Context } from '~/utils/globals';

export const developmentRouter = new Hono<Context>();

developmentRouter.get('/introspect', ...introspect);
