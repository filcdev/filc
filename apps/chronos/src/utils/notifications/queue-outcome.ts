/**
 * The delivery queue's per-channel bookkeeping as pure functions, so the
 * retry, satisfied-channel and dead-letter rules can be tested without a
 * database or a mail transport.
 */

/** The delivery flags kept on a job: a `true` channel has been satisfied. */
export type ChannelState = { email: boolean; push: boolean };

export type ChannelName = keyof ChannelState;

/**
 * What one provider attempt reported. `skipped` marks an outcome that retrying
 * cannot improve — as opposed to a real failure, which is the only outcome
 * that leaves the channel unsatisfied and retries it. It covers two cases:
 * there was nothing to deliver to (no mail transport configured, no registered
 * device), and there was something to deliver to but it can never succeed
 * (every device's token is dead, so a retry would fail identically).
 */
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
 * How long to wait before the next attempt: the exponential backoff, or the
 * transport's own rate-limit hint when that is longer.
 */
export function retryDelayMs(backoffMs: number, retryAfterMs = 0): number {
  return Math.max(backoffMs, retryAfterMs);
}
