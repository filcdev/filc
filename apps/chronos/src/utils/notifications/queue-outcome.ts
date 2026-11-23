/**
 * The delivery queue's per-channel bookkeeping as pure functions, so the
 * retry, satisfied-channel and dead-letter rules can be tested without a
 * database or a mail transport.
 */

/** The delivery flags kept on a job: a `true` channel has been satisfied. */
export type ChannelState = { email: boolean; push: boolean };

export type ChannelName = keyof ChannelState;

/** `skipped`: retrying cannot change the outcome. */
export type ChannelAttemptResult = {
  ok: boolean;
  skipped?: boolean;
};

/**
 * A job starts with a disabled email channel already satisfied: it was never
 * going to deliver, so it must not be attempted, retried or named in the
 * dead-letter. Push has no user-facing switch and is always attempted.
 */
export function initialChannelState(emailEnabled: boolean): ChannelState {
  return { email: !emailEnabled, push: false };
}

/** Whether one attempt satisfied its channel (delivered, or nothing to do). */
export function isChannelSatisfied(result: ChannelAttemptResult): boolean {
  return result.ok || result.skipped === true;
}

/** The job is done once every channel has been satisfied. */
export function isJobDone(delivered: ChannelState): boolean {
  return delivered.email && delivered.push;
}

/**
 * The channels a dead-letter names: only the ones that were attempted and
 * still have not delivered, so a channel that was satisfied — including a
 * disabled email — is never reported as a failure.
 */
export function failedChannels(delivered: ChannelState): ChannelName[] {
  const failed: ChannelName[] = [];
  if (!delivered.email) {
    failed.push('email');
  }
  if (!delivered.push) {
    failed.push('push');
  }
  return failed;
}

/**
 * The longest a single retry wait may be: a `Retry-After` hint beyond this is
 * capped so a bad header cannot park the job forever, and the attempt budget
 * still bounds the job.
 */
export const MAX_RETRY_WAIT_MS = 15 * 60_000;

/**
 * How long to wait before the next attempt: the exponential backoff, or the
 * transport's own rate-limit hint when that is longer, capped at
 * `MAX_RETRY_WAIT_MS`.
 */
export function retryDelayMs(backoffMs: number, retryAfterMs = 0): number {
  return Math.min(Math.max(backoffMs, retryAfterMs), MAX_RETRY_WAIT_MS);
}
