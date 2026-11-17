import { describe, expect, it, mock } from 'bun:test';
import type { DeliveryDeps } from '#utils/notifications/queue';
import { MAX_RETRY_WAIT_MS } from '#utils/notifications/queue-outcome';
import type { DeliveryJob } from '#utils/notifications/types';

/**
 * The queue module reaches the environment and the database through its two
 * providers at load time. Both are stubbed before the dynamic import so the
 * file runs without a local `.env` (a static import would bind the real
 * modules, whose schema parse needs every secret).
 */
mock.module('#utils/environment', () => ({
  env: {
    authSecret: 'test-unsubscribe-secret',
    baseUrl: 'https://filc.test',
    databaseUrl: 'postgres://localhost:5432/filc_test',
    drizzleDebug: false,
    mailTransport: 'smtp',
    mode: 'test',
    smtpAuth: 'basic',
    smtpPort: 587,
    smtpSecure: false,
    timeZone: 'Europe/Budapest',
  },
}));
mock.module('#database', () => ({ db: {} }));

const { attemptJob } = await import('#utils/notifications/queue');

/** A job with both channels enabled, overridable per test. */
function deliveryJob(overrides: Partial<DeliveryJob> = {}): DeliveryJob {
  return {
    content: 'A lesson moved.',
    email: 'student@example.com',
    emailEnabled: true,
    language: 'en',
    notificationId: 'notification-1',
    recipientName: 'Student',
    title: 'Lesson moved',
    type: 'moved_lesson',
    userId: 'user-1',
    ...overrides,
  };
}

/**
 * Fake deps: both providers succeed unless a test overrides them, `schedule`
 * records the wait without running the callback, so an attempt never
 * re-enqueues itself behind the test's back.
 */
function fakeDeps(overrides: Partial<DeliveryDeps> = {}) {
  const scheduled: number[] = [];
  const deps: DeliveryDeps = {
    capture: () => 'event-id',
    schedule: (_fn, ms) => {
      scheduled.push(ms);
    },
    sendEmail: async () => ({ ok: true }),
    sendPush: async () => ({ ok: true }),
    ...overrides,
  };
  return { deps, scheduled };
}

describe('attemptJob', () => {
  it('ends the job on a first-attempt success and never schedules', async () => {
    const { deps, scheduled } = fakeDeps();
    const job = deliveryJob();

    await attemptJob(job, deps);

    expect(scheduled).toEqual([]);
    expect(job.attempt).toBe(1);
    expect(job.delivered).toEqual({ email: true, push: true });
  });

  it('schedules the capped 429 hint and consumes one attempt', async () => {
    const hint = 30 * 60_000;
    const { deps, scheduled } = fakeDeps({
      sendEmail: async () => ({ ok: false, retryAfterMs: hint }),
      sendPush: async () => ({ ok: false }),
    });
    const job = deliveryJob();

    await attemptJob(job, deps);

    expect(scheduled).toEqual([Math.min(hint, MAX_RETRY_WAIT_MS)]);
    expect(scheduled).toEqual([MAX_RETRY_WAIT_MS]);
    expect(job.attempt).toBe(1);
  });

  it('reschedules a transient failure and increments the attempt', async () => {
    const { deps, scheduled } = fakeDeps({
      sendEmail: async () => ({ ok: false }),
      sendPush: async () => ({ ok: false }),
    });
    const job = deliveryJob();

    await attemptJob(job, deps);

    expect(scheduled).toHaveLength(1);
    // Attempt 1's backoff: 2 s plus jitter, below the 30 s cap.
    expect(scheduled[0]).toBeGreaterThanOrEqual(2000);
    expect(scheduled[0]).toBeLessThanOrEqual(3000);
    expect(job.attempt).toBe(1);
    expect(job.delivered).toEqual({ email: false, push: false });
  });

  it('dead-letters after three failures, naming only the unsatisfied channels', async () => {
    const deadLetters: Array<{ error: unknown; hint: unknown }> = [];
    const { deps, scheduled } = fakeDeps({
      capture: (error, hint) => {
        deadLetters.push({ error, hint });
        return 'event-id';
      },
      sendEmail: async () => ({ ok: false }),
      sendPush: async () => ({ ok: false }),
    });
    const job = deliveryJob();

    await attemptJob(job, deps);
    await attemptJob(job, deps);
    expect(deadLetters).toHaveLength(0);
    await attemptJob(job, deps);

    expect(job.attempt).toBe(3);
    expect(scheduled).toHaveLength(2);
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0]?.hint).toMatchObject({
      extra: { channels: ['email', 'push'] },
    });
    expect(String(deadLetters[0]?.error)).toContain(
      'dead-lettered after 3 attempts'
    );
  });

  it('treats a skipped provider result as a satisfied channel', async () => {
    const { deps, scheduled } = fakeDeps({
      sendEmail: async () => ({ ok: false, skipped: true }),
    });
    const job = deliveryJob();

    await attemptJob(job, deps);

    expect(scheduled).toEqual([]);
    expect(job.delivered).toEqual({ email: true, push: true });
  });

  it('does not attempt a channel that already delivered on a retry', async () => {
    let emailCalls = 0;
    let pushCalls = 0;
    const { deps } = fakeDeps({
      sendEmail: () => {
        emailCalls++;
        return Promise.resolve({ ok: true });
      },
      sendPush: () => {
        pushCalls++;
        return Promise.resolve({ ok: false });
      },
    });
    const job = deliveryJob();

    await attemptJob(job, deps);
    await attemptJob(job, deps);

    expect(emailCalls).toBe(1);
    expect(pushCalls).toBe(2);
  });
});
