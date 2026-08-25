import z from 'zod';

/**
 * Success envelope returned by every Chronos endpoint: `{ data, success }`.
 * Mirrors the runtime shape produced by Chronos' `ok()` helper and consumed
 * by `unwrapResponse` in this package.
 */
export type SuccessEnvelope<T = undefined> = [T] extends [undefined]
  ? { success: true; data?: T }
  : { success: true; data: T };

/**
 * Error envelope returned by Chronos when a handler fails. `error` is a
 * human-readable message; `code` is the machine-readable ErrorCode (absent
 * on legacy error paths — treat missing as `'UNKNOWN'`).
 */
export type ErrorEnvelope = {
  cause?: unknown;
  data?: unknown;
  error: string;
  success: false;
};

export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

/** Schema for validating a success envelope whose payload is `data`. */
export const successEnvelopeSchema = <T extends z.ZodType>(data: T) =>
  z.object({
    data,
    success: z.boolean(),
  });

/** Schema for validating an error envelope. */
export const errorEnvelopeSchema = z.object({
  cause: z.unknown().optional(),
  error: z.string(),
  success: z.literal(false),
});
