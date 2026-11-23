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

/** A roomed event was registered for without naming a room. */
export const roomRequired = (message = 'Choose a room for this event') =>
  errors.ROOM_REQUIRED({ message });

/** The room does not exist, or belongs to another event. */
export const roomNotFound = (message = 'Room not found') =>
  errors.ROOM_NOT_FOUND({ message });

/** Losing the race for a room's last place. */
export const roomFull = (message = 'This room is full') =>
  errors.ROOM_FULL({ message });

/** A room still referenced by a registration cannot be deleted. */
export const roomHasRegistrations = (
  message = 'This room already has registrations'
) => errors.ROOM_HAS_REGISTRATIONS({ message });

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
