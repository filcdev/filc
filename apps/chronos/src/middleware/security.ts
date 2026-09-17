import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { env } from '#utils/environment';

export const securityMiddleware = secureHeaders({
  contentSecurityPolicy: {
    baseUri: ["'self'"],
    childSrc: ["'self'"],
    connectSrc: ["'self'"],
    defaultSrc: ["'self'"],
    fontSrc: ["'self'", 'https:', 'data:'],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    frameSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    manifestSrc: ["'self'"],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    reportTo: 'endpoint-1',
    sandbox: ['allow-same-origin', 'allow-scripts'],
    scriptSrc: ["'self'"],
    scriptSrcAttr: ["'none'"],
    // let swagger UI load its styles
    scriptSrcElem: ["'self' ", 'https:', "'unsafe-inline'"],
    styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
    styleSrcAttr: ["'none'"],
    styleSrcElem: ["'self'", 'https:', "'unsafe-inline'"],
    upgradeInsecureRequests: [],
    workerSrc: ["'self'"],
  },
  // The kiosk SPA is served from a host of its own (a static build with nothing
  // proxying /api) and shows announcement images straight from this API, so its
  // responses must stay embeddable across origins. Left as `same-origin`, the
  // browser blocks the image with ERR_BLOCKED_BY_RESPONSE.NotSameOrigin.
  crossOriginResourcePolicy: 'cross-origin',
});

export const corsMiddleware = cors({
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // Local dev accepts any origin; a deployment only accepts its own origins —
  // the API itself plus the static apps (the kiosk build) that call it by
  // absolute URL from a host of their own.
  origin:
    env.mode === 'development'
      ? '*'
      : [env.baseUrl, ...(env.trustedOrigins ?? [])],
});
