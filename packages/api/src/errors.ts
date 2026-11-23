import type { ErrorMap } from '@orpc/contract';
import z from 'zod';

/**
 * Machine-readable error codes for the Filc API. Every procedure answers with
 * one of these: the code travels over the wire in the oRPC error payload and is
 * what clients branch on (`isDefinedError(error) && error.code === 'CONFLICT'`).
 */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'CONFLICT',
  'FORBIDDEN',
  'INTERNAL',
  'NOT_FOUND',
  'RATE_LIMITED',
  'ROOM_FULL',
  'ROOM_HAS_REGISTRATIONS',
  'ROOM_NOT_FOUND',
  'ROOM_REQUIRED',
  'UNAUTHORIZED',
  'UNKNOWN',
  'VALIDATION',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * The same codes as named constants, derived from the list above so the two
 * cannot disagree. A call site reads `ERROR_CODE.CONFLICT` rather than the
 * string literal: a typo then fails to compile instead of silently never
 * matching.
 */
export const ERROR_CODE: Record<ErrorCode, ErrorCode> = Object.fromEntries(
  ERROR_CODES.map((code) => [code, code])
) as Record<ErrorCode, ErrorCode>;

/**
 * The contract-wide error map. Statuses and default messages reproduce the
 * statuses the previous status-derived mapping produced, so clients keep
 * seeing the same HTTP status for the same failure; `BAD_REQUEST` is what oRPC raises
 * for input-schema failures, `VALIDATION` is for handlers rejecting a payload
 * explicitly.
 */
export const apiErrors = {
  BAD_REQUEST: { message: 'Validation failed', status: 400 },
  CONFLICT: { message: 'Conflict', status: 409 },
  FORBIDDEN: { message: 'Forbidden', status: 403 },
  INTERNAL: { message: 'Internal Server Error', status: 500 },
  NOT_FOUND: { message: 'Not found', status: 404 },
  RATE_LIMITED: {
    data: z.object({ retryAfter: z.coerce.number().optional() }),
    message: 'Too many requests',
    status: 429,
  },
  ROOM_FULL: { message: 'This room is full', status: 409 },
  ROOM_HAS_REGISTRATIONS: {
    message: 'This room already has registrations',
    status: 409,
  },
  ROOM_NOT_FOUND: { message: 'Room not found', status: 404 },
  ROOM_REQUIRED: { message: 'Choose a room for this event', status: 400 },
  UNAUTHORIZED: { message: 'Unauthorized', status: 401 },
  UNKNOWN: { message: 'Unknown error', status: 500 },
  VALIDATION: { message: 'Validation failed', status: 400 },
} as const satisfies ErrorMap;
