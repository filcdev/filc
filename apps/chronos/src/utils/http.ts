import { apiErrors } from '@filcdev/api/errors';
import { createORPCErrorConstructorMap, ORPCError } from '@orpc/server';

/**
 * Error factories built from the shared contract error map, so every thrown
 * error carries its code's HTTP status and default message and comes back to
 * clients as a *defined* error (`isDefinedError(error) === true`), which is
 * what lets callers branch on `error.code`.
 */
const errors = createORPCErrorConstructorMap(apiErrors);

export const notFound = (message = 'Not found', cause?: unknown) =>
  errors.NOT_FOUND({ cause, message });

export const conflict = (message: string, cause?: unknown) =>
  errors.CONFLICT({ cause, message });

export const badRequest = (message: string, cause?: unknown) =>
  errors.VALIDATION({ cause, message });

export const forbidden = (message = 'Forbidden', cause?: unknown) =>
  errors.FORBIDDEN({ cause, message });

export const unauthorized = (message = 'Unauthorized', cause?: unknown) =>
  errors.UNAUTHORIZED({ cause, message });

/**
 * 503: the dependency behind the endpoint (object storage, an upstream API) is
 * missing. Deliberately outside the shared map — the status differs from
 * `INTERNAL`'s, so it stays an undocumented, non-defined error.
 */
export const serviceUnavailable = (message: string, cause?: unknown) =>
  new ORPCError('INTERNAL', { cause, message, status: 503 });

/**
 * 502: an upstream the endpoint proxies (weather, departures, an RSS feed)
 * answered with an error. Same reasoning as `serviceUnavailable`.
 */
export const badGateway = (message: string, cause?: unknown) =>
  new ORPCError('INTERNAL', { cause, message, status: 502 });
