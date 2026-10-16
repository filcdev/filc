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
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import type { ChronosContext } from '#_types/globals';
import { prepareDb } from '#database';
import { resolveCaller } from '#middleware/auth';
import {
  type DeviceSocketData,
  DOORLOCK_SOCKET_PATH,
  handlers as deviceSocketHandlers,
  upgrade as upgradeDeviceSocket,
} from '#modules/doorlock/device-socket';
import { handleUnsubscribe } from '#modules/notifications/unsubscribe-html';
import { appRouter } from '#router';
import { auth } from '#utils/authentication';
import { initializeRBAC } from '#utils/authorization';
import { setupCronJobs } from '#utils/cron';
import { env } from '#utils/environment';
import { configureLogger } from '#utils/logger';
import { initializeNotificationEngine } from '#utils/notifications/initialize';
import { openApiSpecOptions } from '#utils/openapi-spec';
import {
  corsPlugins,
  MAX_REQUEST_BODY_BYTES,
  resolveClientIp,
  withSecurityHeaders,
} from '#utils/security';
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
await initializeNotificationEngine();

const isDevelopment = env.mode === 'development';

type ClientInterceptor = NonNullable<
  RPCHandlerOptions<ChronosContext>['clientInterceptors']
>[number];

/**
 * Turns anything a handler throws that is not already an `ORPCError` into a
 * logged `INTERNAL` error: the message is the raw one in development and the
 * generic one in production, so internal failures never leak their details.
 *
 * The log line carries the request id, the client address and the procedure
 * that failed, because a bare stack is not enough to tell *which* request
 * produced it once more than one is in flight.
 */
const errorBoundaryInterceptor: ClientInterceptor = async ({
  context,
  next,
  path,
}) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof ORPCError) {
      throw error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('UNCAUGHT API error occurred:', {
      context: {
        clientIp: context.clientIp,
        procedure: path.join('/'),
        requestId: context.requestId,
        userId: context.user?.id ?? context.session?.userId ?? null,
      },
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

/**
 * Request log: `debug` line in development, structured `info` line otherwise.
 * Carries the request id so it can be joined to the error boundary's line and
 * to a client's `x-request-id` response header.
 */
const timingInterceptor: AdapterInterceptor = async (options) => {
  const start = Date.now();
  const result = await options.next();
  const ms = Date.now() - start;

  const status = result.response?.status ?? 404;
  const { method } = options.request;
  const { url } = options.request;
  const {
    context: { clientIp, requestId, user },
  } = options;

  if (isDevelopment) {
    logger.debug(`${method} ${url} - ${ms}ms`, {
      duration: ms,
      method,
      requestId,
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
    requestId,
    status,
    ua: options.request.headers.get('user-agent') ?? 'unknown',
    url,
    user: user ? { email: user.email, id: user.id } : null,
  });

  return result;
};

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

const buildContext = async (
  request: Request,
  srv: Bun.Server<DeviceSocketData>
): Promise<ChronosContext> => ({
  ...(await resolveCaller(request.headers)),
  clientIp: resolveClientIp(request, srv),
  reqHeaders: request.headers,
  // Echoed on the response as `x-request-id`, so a client can name the exact
  // request it is reporting and the line can be found in the log stream.
  requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
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
      return withSecurityHeaders(await auth.handler(request), url.pathname);
    }

    // The unsubscribe pages are HTML forms and links from emails: no envelope,
    // no oRPC.
    if (url.pathname === '/api/notifications/unsubscribe') {
      return withSecurityHeaders(
        await handleUnsubscribe(request),
        url.pathname
      );
    }

    const requestId =
      request.headers.get('x-request-id') ?? crypto.randomUUID();
    const context = await buildContext(request, srv);
    const { matched, response } = url.pathname.startsWith('/api/rpc/')
      ? await rpcHandler.handle(request, { context, prefix: '/api/rpc' })
      : await openApiHandler.handle(request, { context, prefix: '/api' });

    const final = withSecurityHeaders(
      matched && response
        ? response
        : new Response('Not found', { status: 404 }),
      url.pathname
    );
    final.headers.set('x-request-id', requestId);

    return final;
  },
  maxRequestBodySize: MAX_REQUEST_BODY_BYTES,
  port: env.port,
  websocket: deviceSocketHandlers,
});

logger.info(`chronos listening on http://localhost:${env.port}`);

const handleShutdown = async () => {
  logger.info('Shutting down chronos...');
  await server.stop();
  logger.info('Shutdown complete, exiting.');
  process.exit(0);
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
