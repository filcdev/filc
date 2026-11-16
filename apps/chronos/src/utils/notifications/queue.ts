import { getLogger } from '@logtape/logtape';
import { captureException } from '@sentry/bun';
import { sendPush } from '#utils/notifications/providers/fcm';
import { sendEmail } from '#utils/notifications/providers/smtp';
import {
  failedChannels,
  initialChannelState,
  isChannelSatisfied,
  isJobDone,
  retryDelayMs,
} from '#utils/notifications/queue-outcome';
import type { DeliveryJob } from '#utils/notifications/types';

const logger = getLogger(['chronos', 'notifications', 'queue']);

const queue: DeliveryJob[] = [];
let processing = false;
const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const RATE_LIMIT_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt + Math.random() * 1000, 30_000);
}

/**
 * The outcome of one delivery attempt. `done` is false while a channel that
 * should deliver has not; `retryAfterMs` is the email transport's rate-limit
 * hint, when it gave one.
 */
type JobOutcome = {
  done: boolean;
  retryAfterMs?: number;
};

/**
 * How many attempts a job has had. The job object is re-enqueued, so its
 * `delivered` state — and this count — survive the wait for a retry.
 */
const attempts = new WeakMap<DeliveryJob, number>();

/**
 * Attempts every channel the job has not delivered yet. A channel that
 * succeeds — or that had nothing to deliver — is recorded on the job, so a
 * later attempt never repeats it. A disabled email starts out satisfied (see
 * `initialChannelState`), never a failure to retry or to name in the
 * dead-letter. Push has no user-facing switch, so it is always attempted; a
 * user without a registered device is satisfied by the provider's `skipped`
 * answer.
 */
async function processJob(job: DeliveryJob): Promise<JobOutcome> {
  job.delivered ??= initialChannelState(job.emailEnabled);
  const { delivered } = job;
  let retryAfterMs: number | undefined;

  const emailPromise = delivered.email
    ? Promise.resolve()
    : sendEmail(
        job.email,
        job.type,
        job.language,
        {
          content: job.content,
          details: job.details,
          highlights: job.highlights,
          title: job.title,
        },
        job.userId,
        job.recipientName
      )
        .then((result) => {
          retryAfterMs = result.retryAfterMs;
          delivered.email = isChannelSatisfied(result);
        })
        .catch((error: unknown) => {
          logger.warning('Email delivery attempt failed for {notificationId}', {
            error,
            notificationId: job.notificationId,
          });
        });

  const pushPromise = delivered.push
    ? Promise.resolve()
    : sendPush(job.userId, job.title, job.content)
        .then((result) => {
          delivered.push = isChannelSatisfied(result);
        })
        .catch((error: unknown) => {
          logger.warning('Push delivery attempt failed for {notificationId}', {
            error,
            notificationId: job.notificationId,
          });
        });

  await Promise.all([emailPromise, pushPromise]);

  return isJobDone(delivered) ? { done: true } : { done: false, retryAfterMs };
}

async function attemptJob(job: DeliveryJob): Promise<void> {
  const attempt = (attempts.get(job) ?? 0) + 1;
  attempts.set(job, attempt);

  let retryAfterMs = 0;
  try {
    const outcome = await processJob(job);
    if (outcome.done) {
      return;
    }
    retryAfterMs = outcome.retryAfterMs ?? 0;
  } catch (error) {
    // Defensive only: each channel handles its own failure above, so this
    // fires on a bug rather than on a delivery failure.
    logger.debug('Job attempt {attempt} threw for {notificationId}', {
      attempt,
      error,
      notificationId: job.notificationId,
    });
  }

  if (attempt < MAX_RETRIES) {
    const delay = retryDelayMs(backoffMs(attempt), retryAfterMs);
    logger.debug(
      'Retrying job {notificationId} in {delay}ms (attempt {attempt}/{max})',
      {
        attempt: attempt + 1,
        delay,
        max: MAX_RETRIES,
        notificationId: job.notificationId,
      }
    );
    // ponytail: the retry is a `setTimeout` on an in-memory schedule — the
    // queue has no durable store — so a process restart inside the delay window
    // loses this attempt, the same ceiling as the engine's delayed
    // notifications. No worker is held while it waits.
    setTimeout(() => {
      queue.push(job);
      pump();
    }, delay);
    return;
  }

  const delivered = job.delivered ?? initialChannelState(job.emailEnabled);
  const channels = failedChannels(delivered);
  const context = {
    channels,
    notificationId: job.notificationId,
    userId: job.userId,
  };

  logger.error(
    'Job {notificationId} for user {userId} failed after {max} retries, dead-lettering channels {channels}',
    { ...context, max: MAX_RETRIES }
  );
  // A dead-lettered notification is a silent loss for its recipient unless
  // someone is told, so it goes to Sentry as well as the log.
  captureException(
    new Error(
      `Notification ${job.notificationId} dead-lettered after ${MAX_RETRIES} attempts`
    ),
    { extra: context, tags: { notificationType: job.type } }
  );
}

async function processLoop(): Promise<void> {
  if (processing) {
    return;
  }
  processing = true;

  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, CONCURRENCY);
      await Promise.all(batch.map(attemptJob));

      if (queue.length > 0) {
        await sleep(RATE_LIMIT_MS);
      }
    }
  } finally {
    processing = false;
  }
}

/**
 * Starts the loop without awaiting it: a crash in the loop must be logged, not
 * left as an unhandled rejection. Used by `enqueue` and by a scheduled retry.
 */
function pump(): void {
  processLoop().catch((error: unknown) => {
    logger.error('Delivery loop crashed', { error });
  });
}

export function enqueue(job: DeliveryJob): void {
  queue.push(job);
  logger.debug('Enqueued delivery job {notificationId}', {
    notificationId: job.notificationId,
  });
  pump();
}
