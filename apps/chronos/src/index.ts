import process from 'node:process';
import { apiErrors } from '@filcdev/api/errors';
import { getLogger } from '@logtape/logtape';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { ORPCError } from '@orpc/server';
import type {
  FetchHandlerOptions,
  RPCHandlerOptions,
} from '@orpc/server/fetch';
import { RPCHandler } from '@orpc/server/fetch';
import { CORSPlugin, ResponseHeadersPlugin } from '@orpc/server/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import type { ChronosContext } from '#_types/globals';
import { prepareDb } from '#database';
import { resolveCaller } from '#middleware/auth';
import { appRouter } from '#router';
import {
  type DeviceSocketData,
  DOORLOCK_SOCKET_PATH,
  handlers as deviceSocketHandlers,
  upgrade as upgradeDeviceSocket,
} from '#routes/doorlock/device-socket';
import { handleUnsubscribe } from '#routes/notifications/unsubscribe-html';
import { auth } from '#utils/authentication';
import { initializeRBAC } from '#utils/authorization';
import { setupCronJobs } from '#utils/cron';
import { env } from '#utils/environment';
import { configureLogger } from '#utils/logger';
import { initializeNotificationEngine } from '#utils/notifications/initialize';
import { openApiSpecOptions } from '#utils/openapi-spec';
import { initSentry } from '#utils/telemetry';

await configureLogger('chronos');
const logger = getLogger(['chronos', 'server']);

initSentry();

if (env.mode === 'development') {
  logger.warn('Running in development mode, do not use in production!');
}

await prepareDb();
await initializeRBAC();
setupCronJobs();
initializeNotificationEngine();

/**
 * The header set the pre-oRPC `secureHeaders` middleware produced, applied to
 * every response the server emits. `script-src-elem`/`style-src-elem` keep
 * allowing the CDN bundles Swagger UI loads, and `Cross-Origin-Resource-Policy:
 * cross-origin` keeps announcement images embeddable by the kiosk build, which
 * is served from a host of its own.
 */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy':
    "base-uri 'self'; child-src 'self'; connect-src 'self'; default-src 'self'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; frame-src 'self'; img-src 'self' data:; manifest-src 'self'; media-src 'self'; object-src 'none'; report-to endpoint-1; sandbox allow-same-origin allow-scripts; script-src 'self'; script-src-attr 'none'; script-src-elem 'self'  https: 'unsafe-inline'; style-src 'self' https: 'unsafe-inline'; style-src-attr 'none'; style-src-elem 'self' https: 'unsafe-inline'; upgrade-insecure-requests; worker-src 'self'",
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

const withSecurityHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const isDevelopment = env.mode === 'development';

type ClientInterceptor = NonNullable<
  RPCHandlerOptions<ChronosContext>['clientInterceptors']
>[number];

/**
 * Turns anything a handler throws that is not already an `ORPCError` into a
 * logged `INTERNAL` error: the message is the raw one in development and the
 * generic one in production, so internal failures never leak their details.
 */
const errorBoundaryInterceptor: ClientInterceptor = async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof ORPCError) {
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('UNCAUGHT API error occurred:', {
      message: err.message,
      stack: err.stack,
    });

    throw new ORPCError('INTERNAL', {
      cause: err,
      message: isDevelopment ? err.message : 'Internal Server Error',
      status: apiErrors.INTERNAL.status,
    });
  }
};

type AdapterInterceptor = NonNullable<
  FetchHandlerOptions<ChronosContext>['adapterInterceptors']
>[number];

/** Request log: trace line in development, structured line otherwise. */
const timingInterceptor: AdapterInterceptor = async (options) => {
  const start = Date.now();
  const result = await options.next();
  const ms = Date.now() - start;

  const status = result.response?.status ?? 404;
  const { method } = options.request;
  const { url } = options.request;
  const {
    context: { user, clientIp },
  } = options;

  if (isDevelopment) {
    logger.trace(`${method} ${url} - ${ms}ms`, {
      duration: ms,
      method,
      status,
      url,
      user: user ? { email: user.email, id: user.id } : null,
    });

    return result;
  }

  logger.info('Received request', {
    duration: ms,
    ip: clientIp,
    method,
    status,
    ua: options.request.headers.get('user-agent') ?? 'unknown',
    url,
    user: user ? { email: user.email, id: user.id } : null,
  });

  return result;
};

const corsPlugins = () => [
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

const openApiPlugin = new OpenAPIReferencePlugin<ChronosContext>({
  docsPath: '/doc/swagger',
  docsProvider: 'swagger',
  docsTitle: 'Chronos backend API',
  schemaConverters: [new ZodToJsonSchemaConverter()],
  specGenerateOptions: openApiSpecOptions,
  specPath: '/doc/openapi.json',
});

export const rpcHandler = new RPCHandler<ChronosContext>(appRouter, {
  adapterInterceptors: [timingInterceptor],
  clientInterceptors: [errorBoundaryInterceptor],
  plugins: corsPlugins(),
});

export const openApiHandler = new OpenAPIHandler<ChronosContext>(appRouter, {
  adapterInterceptors: [timingInterceptor],
  clientInterceptors: [errorBoundaryInterceptor],
  plugins: [...corsPlugins(), openApiPlugin],
});

/**
 * Everything the transport knows before a procedure runs. Built per request,
 * once, only for the requests that reach an oRPC handler.
 */
const buildContext = async (
  request: Request,
  srv: Bun.Server<DeviceSocketData>
): Promise<ChronosContext> => ({
  ...(await resolveCaller(request.headers)),
  clientIp: env.realIpHeader
    ? (request.headers.get(env.realIpHeader) ?? '')
    : (srv.requestIP(request)?.address ?? 'unknown'),
  reqHeaders: request.headers,
});

export const server = Bun.serve<DeviceSocketData>({
  fetch: async (request, srv) => {
    const url = new URL(request.url);

    // The aegis firmware speaks a hand-rolled JSON protocol over this socket,
    // not oRPC, so it is handled before either handler.
    if (url.pathname === DOORLOCK_SOCKET_PATH) {
      return upgradeDeviceSocket(request, srv);
    }

    // better-auth owns /api/auth/*; it answers its own JSON and HTML.
    if (url.pathname.startsWith('/api/auth/')) {
      return withSecurityHeaders(await auth.handler(request));
    }

    // The unsubscribe pages are HTML forms and links from emails: no envelope,
    // no oRPC.
    if (url.pathname === '/api/notifications/unsubscribe') {
      return withSecurityHeaders(await handleUnsubscribe(request));
    }

    const context = await buildContext(request, srv);
    const { matched, response } = url.pathname.startsWith('/api/rpc/')
      ? await rpcHandler.handle(request, { context, prefix: '/api/rpc' })
      : await openApiHandler.handle(request, { context, prefix: '/api' });

    return withSecurityHeaders(
      matched && response
        ? response
        : new Response('Not found', { status: 404 })
    );
  },
  port: env.port,
  websocket: deviceSocketHandlers,
});

logger.info(`chronos listening on http://localhost:${env.port}`);
if (env.logLevel === 'trace') {
  logger.info('Log level set to TRACE, verbose request logging enabled');
}

const handleShutdown = async () => {
  logger.info('Shutting down chronos...');
  await server.stop();
  logger.info('Shutdown complete, exiting.');
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
