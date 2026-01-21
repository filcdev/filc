import { getLogger } from '@logtape/logtape';
import { getConnInfo } from 'hono/bun';
import { createMiddleware } from 'hono/factory';
import { env } from '#utils/environment';
import type { Context } from '#utils/types/globals';

const logger = getLogger(['chronos', 'server']);

export const timingMiddleware = createMiddleware<Context>(async (c, next) => {
  const start = Date.now();

  await next();

  const ms = Date.now() - start;

  if (env.mode === 'development') {
    logger.debug(`${c.req.method} ${c.req.url} - ${ms}ms`, {
      duration: ms,
      method: c.req.method,
      url: c.req.url,
      user: c.get('user')
        ? { email: c.get('user')?.email, id: c.get('user')?.id }
        : null,
    });

    return;
  }

  const connInfo = getConnInfo(c);
  const remoteAddr = env.realIpHeader
    ? c.req.header(env.realIpHeader)
    : connInfo?.remote.address;
  logger.info('Received request', {
    duration: ms,
    ip: remoteAddr ?? 'unknown',
    method: c.req.method,
    status: c.res.status,
    ua: c.req.header('user-agent') ?? 'unknown',
    url: c.req.url,
    user: c.get('user')
      ? { email: c.get('user')?.email, id: c.get('user')?.id }
      : null,
  });
});
