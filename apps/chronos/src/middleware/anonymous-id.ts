import { randomUUID } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import type { Context } from '#_types/globals';
import { env } from '#utils/environment';

export const anonymousIdMiddleware = createMiddleware<Context>((c, next) => {
  const session = c.get('session');

  // Authenticated users don't need an anonymous ID
  if (session) {
    return next();
  }

  const cookieName = env.rateLimitCookieName;
  const existingId = c.req
    .header('Cookie')
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`))
    ?.split('=')[1];

  if (existingId) {
    c.set('anonymousId', existingId);
  } else {
    const id = randomUUID();
    c.set('anonymousId', id);
    c.header(
      'Set-Cookie',
      `${cookieName}=${id}; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}; Path=/`
    );
  }

  return next();
});
