import { getLogger } from '@logtape/logtape';
import { sendPush } from '#utils/notifications/providers/fcm';
import { sendEmail } from '#utils/notifications/providers/smtp';
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

async function processJob(job: DeliveryJob): Promise<boolean> {
  if (!job.channelsEnabled) {
    logger.debug('Channels disabled for user {userId}, skipping delivery', {
      userId: job.userId,
    });
    return true;
  }

  let emailSuccess = false;
  let pushSuccess = false;

  const emailPromise = sendEmail(job.email, job.title, job.type, 'hu', {
    content: job.content,
    title: job.title,
  })
    .then((ok) => {
      emailSuccess = ok;
    })
    .catch(() => {
      emailSuccess = false;
    });

  const pushPromise = sendPush(job.userId, job.title, job.content)
    .then((ok) => {
      pushSuccess = ok;
    })
    .catch(() => {
      pushSuccess = false;
    });

  await Promise.all([emailPromise, pushPromise]);

  return emailSuccess || pushSuccess;
}

async function tryProcessJob(job: DeliveryJob): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const ok = await processJob(job);
      if (ok) {
        return;
      }
    } catch (error) {
      logger.debug('Job attempt {attempt} failed for {notificationId}', {
        attempt: attempt + 1,
        error,
        notificationId: job.notificationId,
      });
    }

    if (attempt < MAX_RETRIES - 1) {
      const delay = backoffMs(attempt + 1);
      logger.debug(
        'Retrying job {notificationId} in {delay}ms (attempt {attempt}/{max})',
        {
          attempt: attempt + 2,
          delay,
          max: MAX_RETRIES,
          notificationId: job.notificationId,
        }
      );
      await sleep(delay);
    }
  }

  logger.error(
    'Job {notificationId} failed after {max} retries, dead-lettering',
    {
      max: MAX_RETRIES,
      notificationId: job.notificationId,
    }
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
      await Promise.all(batch.map(tryProcessJob));

      if (queue.length > 0) {
        await sleep(RATE_LIMIT_MS);
      }
    }
  } finally {
    processing = false;
  }
}

export function enqueue(job: DeliveryJob): void {
  queue.push(job);
  logger.debug('Enqueued delivery job {notificationId}', {
    notificationId: job.notificationId,
  });
  processLoop();
}
