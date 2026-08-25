/**
 * Machine-readable error codes for the Filc API. Backend handlers adopt
 * these incrementally; every error without an explicit code is surfaced as
 * `'UNKNOWN'` by `unwrapResponse`.
 */
export const ERROR_CODES = [
  'CONFLICT',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'UNAUTHORIZED',
  'UNKNOWN',
  'VALIDATION',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Error thrown by `unwrapResponse` when the API returns a failure envelope
 * or the request itself fails. Carries the structured pieces callers need
 * to branch on (`code`, HTTP `status`) instead of parsing message strings.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly status?: number;

  constructor(
    code: ErrorCode,
    options: {
      cause?: unknown;
      details?: unknown;
      message: string;
      status?: number;
    }
  ) {
    super(options.message, { cause: options.cause });
    this.name = 'ApiError';
    this.code = code;
    this.details = options.details;
    if (options.status !== undefined) {
      this.status = options.status;
    }
  }
}
