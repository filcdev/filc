/**
 * The FCM multicast batch response as a pure decision, so the "did this push
 * deliver, and may it be retried" rules can be tested without firebase-admin,
 * a database or credentials.
 */

/**
 * The error codes that mean the token itself is dead: re-sending to it can
 * never succeed, so it is deleted instead of retried.
 */
export const INVALID_FCM_TOKEN_CODES: ReadonlySet<string> = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

/** The subset of the SDK's `SendResponse` this decision reads. */
export type FcmSendResponse = {
  success: boolean;
  error?: { code?: string };
};

export type FcmBatchOutcome = {
  /** The channel delivered (or there was nothing to deliver to). */
  ok: boolean;
  /** Satisfied forever: retrying cannot help. Never set together with `ok`. */
  skipped?: boolean;
  /** Tokens the caller should delete. Paired by index with `responses`. */
  invalidTokens: string[];
  deliveredCount: number;
  failedCount: number;
};

/**
 * Turn one `sendEachForMulticast` batch into the channel outcome the delivery
 * queue understands.
 *
 * The decision is derived from `responses`, never from the batch's
 * `successCount`/`failureCount`: those are only the SDK's summary of the same
 * array and can disagree with it, and the per-device responses are what the
 * invalid-token cleanup and the retry decision actually depend on.
 *
 * Rules, in order:
 * - No responses at all: nothing was attempted, so the channel is skipped
 *   rather than failed (callers normally guard the empty-token case first).
 * - At least one device delivered: `ok` at channel level, deliberately, even
 *   if others failed. Retrying the channel would re-send the push to the
 *   devices that already got it; the caller logs the failed devices instead.
 * - Nothing delivered and every failure is a dead token: `skipped`, because a
 *   retry cannot help. The dead tokens are returned for deletion.
 * - Anything else — a transient code, an unknown code, or a mix of dead
 *   tokens and transient failures — is `ok: false`, which is retryable.
 *
 * Tokens and responses are paired by index (the SDK keeps their order),
 * and anything past the shorter array is ignored.
 */
export function interpretFcmBatch(
  tokens: readonly string[],
  responses: readonly FcmSendResponse[]
): FcmBatchOutcome {
  const invalidTokens: string[] = [];
  let deliveredCount = 0;
  let failedCount = 0;
  let hasRetryableFailure = false;

  const paired = Math.min(tokens.length, responses.length);

  for (let i = 0; i < paired; i++) {
    const response = responses[i];
    if (response.success) {
      deliveredCount++;
      continue;
    }

    failedCount++;
    const code = response.error?.code;
    if (code !== undefined && INVALID_FCM_TOKEN_CODES.has(code)) {
      invalidTokens.push(tokens[i]);
    } else {
      hasRetryableFailure = true;
    }
  }

  if (responses.length === 0) {
    return {
      deliveredCount: 0,
      failedCount: 0,
      invalidTokens: [],
      ok: false,
      skipped: true,
    };
  }

  if (deliveredCount > 0) {
    return { deliveredCount, failedCount, invalidTokens, ok: true };
  }

  if (!hasRetryableFailure) {
    return {
      deliveredCount,
      failedCount,
      invalidTokens,
      ok: false,
      skipped: true,
    };
  }

  return { deliveredCount, failedCount, invalidTokens, ok: false };
}
