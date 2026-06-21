import { createHmac, timingSafeEqual } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import type { Context } from '#_types/globals';
import { env } from '#utils/environment';

const SIGNATURE_LENGTH = 64; // SHA-256 hex digest

function sign(id: string): string {
  return createHmac('sha256', env.authSecret).update(id).digest('hex');
}

function verify(cookieValue: string): string | null {
  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex === -1) {
    return null;
  }

  const id = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);
  if (sig.length !== SIGNATURE_LENGTH) {
    return null;
  }

  const expected = sign(id);
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) {
    return null;
  }
  if (!timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  return id;
}

export const anonymousIdMiddleware = createMiddleware<Context>((c, next) => {
  const session = c.get('session');

  // Authenticated users don't need an anonymous ID
  if (session) {
    return next();
  }

  const cookieName = env.rateLimitCookieName;
  const rawCookie = c.req
    .header('Cookie')
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`))
    ?.split('=')
    .slice(1)
    .join('='); // handle values containing '='

  if (rawCookie) {
    const id = verify(rawCookie);
    if (id) {
      c.set('anonymousId', id);
      return next();
    }
  }

  // No valid cookie — do not mint a new UUID; fall back to IP-only rate limiting
  return next();
});
