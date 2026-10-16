/**
 * The HTTP security policy: the response headers every answer carries, the CORS
 * allow-list, the trusted client address, and the request-body ceiling.
 *
 * One module because each is a decision about what to trust. The transport in
 * `#index` applies `withSecurityHeaders` to every response it returns (the
 * better-auth surface, the RPC and OpenAPI handlers, the unsubscribe pages and
 * the door-lock WebSocket handshake) and builds its handlers from `corsPlugins`
 * and its request context from `resolveClientIp`, so a header, an allowed
 * origin, a forwarding header or the body ceiling changes here and nowhere else.
 */
import { CORSPlugin, ResponseHeadersPlugin } from '@orpc/server/plugins';
import type { ChronosContext } from '#_types/globals';
// Type-only: importing the socket module for real would drag `#index` in and
// close a cycle back onto this file.
import type { DeviceSocketData } from '#modules/doorlock/device-socket';
import { env } from '#utils/environment';

/**
 * The directive set every response carries.
 *
 * `style-src`/`style-src-elem` allow `'unsafe-inline'` because the
 * `/api/notifications/unsubscribe` pages ship their CSS in a `<style>` block;
 * nothing here executes inline script, so `script-src*` does not. The one page
 * better-auth serves that would need it is the OAuth popup completion page, and
 * that plugin is not enabled — the sign-in flows here are redirects, and the
 * error page is inline style only.
 */
const BASE_CSP: Readonly<Record<string, readonly string[]>> = {
  'base-uri': ["'self'"],
  'child-src': ["'self'"],
  'connect-src': ["'self'"],
  'default-src': ["'self'"],
  'font-src': ["'self'", 'https:', 'data:'],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
  'frame-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'manifest-src': ["'self'"],
  'media-src': ["'self'"],
  'object-src': ["'none'"],
  'report-to': ['endpoint-1'],
  sandbox: ['allow-same-origin', 'allow-scripts'],
  'script-src': ["'self'"],
  'script-src-attr': ["'none'"],
  'script-src-elem': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'style-src-attr': ["'none'"],
  'style-src-elem': ["'self'", "'unsafe-inline'"],
  'upgrade-insecure-requests': [],
  'worker-src': ["'self'"],
};

const renderCsp = (
  overrides: Readonly<Record<string, readonly string[]>>
): string =>
  Object.entries({ ...BASE_CSP, ...overrides })
    .map(([directive, values]) =>
      values.length > 0 ? `${directive} ${values.join(' ')}` : directive
    )
    .join('; ');

/**
 * Swagger UI is the one page served from here that loads script from a CDN and
 * runs an inline config block, so the docs path gets those two allowances and
 * nothing else does. The host is `unpkg.com` because that is what
 * `OpenAPIReferencePlugin`'s swagger provider loads (see `@orpc/openapi`).
 */
const DOCS_CSP_OVERRIDES = {
  'script-src-elem': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
  'style-src-elem': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
} as const;

/**
 * The header set the pre-oRPC `secureHeaders` middleware produced, applied to
 * every response the server emits. `Cross-Origin-Resource-Policy: cross-origin`
 * keeps announcement images embeddable by the kiosk build, which is served from
 * a host of its own.
 */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': renderCsp({}),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Origin-Agent-Cluster': '?1',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-XSS-Protection': '0',
};

/** The docs page's header set: the default with the CDN allowances added. */
const DOCS_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': renderCsp(DOCS_CSP_OVERRIDES),
};

/** The Swagger UI page, which is the only HTML a browser loads from this path. */
const DOCS_PAGE_PATH = '/api/doc/swagger';

/**
 * Returns a copy of `response` carrying the security headers. `pathname` selects
 * the docs page's looser set; every other path gets the default set.
 */
export const withSecurityHeaders = (
  response: Response,
  pathname?: string
): Response => {
  const headers = new Headers(response.headers);
  const source =
    pathname === DOCS_PAGE_PATH ? DOCS_SECURITY_HEADERS : SECURITY_HEADERS;

  for (const [name, value] of Object.entries(source)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

/** True in development, where the origin policy below is deliberately looser. */
const isDevelopment = env.mode === 'development';

/**
 * The CORS policy. Outside development the origin is an allow-list: the API is
 * cookie-authenticated, so reflecting an arbitrary origin would let any site
 * read authenticated responses. Development reflects the request origin so a
 * frontend on another port works without configuration.
 */
export const corsPlugins = () => [
  new CORSPlugin<ChronosContext>({
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    origin: isDevelopment
      ? (origin) => origin
      : [env.baseUrl, ...(env.trustedOrigins ?? [])],
  }),
  // Lets a procedure set response headers (`context.resHeaders`), which the
  // announcement image uses for its long-lived Cache-Control.
  new ResponseHeadersPlugin<ChronosContext>(),
];

/**
 * The caller's address.
 *
 * The rate limiter keys on this, so it must never be empty: when the
 * configured forwarding header is missing (or blank), every such request would
 * otherwise share one bucket. It falls back to the socket address, which is
 * always present. The header itself is trusted because a deployment only sets
 * `CHRONOS_REAL_IP_HEADER` when it sits behind a proxy that overwrites it.
 */
export const resolveClientIp = (
  request: Request,
  srv: Bun.Server<DeviceSocketData>
): string => {
  const forwarded = env.realIpHeader
    ? request.headers.get(env.realIpHeader)?.trim()
    : undefined;

  return forwarded || srv.requestIP(request)?.address || 'unknown';
};

/**
 * Ceiling for any request body, enforced by Bun before the handler buffers it.
 * The largest legitimate upload is the 20 MiB timetable import
 * (`modules/timetable/import.ts`); Bun's own default is 128 MiB, which is a lot
 * of memory to hand a single unauthenticated-shaped request.
 */
export const MAX_REQUEST_BODY_BYTES = 25 * 1024 * 1024;
