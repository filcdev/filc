import { describe, expect, it } from 'bun:test';
import { interpretFcmBatch } from '#utils/notifications/fcm-outcome';
import { isChannelSatisfied } from '#utils/notifications/queue-outcome';

const delivered = { success: true };
const failed = (code: string) => ({ error: { code }, success: false });

describe('interpretFcmBatch', () => {
  it('satisfies the channel when every device delivered', () => {
    const outcome = interpretFcmBatch(
      ['token-a', 'token-b'],
      [delivered, delivered]
    );

    expect(outcome).toEqual({
      deliveredCount: 2,
      failedCount: 0,
      invalidTokens: [],
      ok: true,
    });
  });

  it('leaves a transient failure retryable', () => {
    const outcome = interpretFcmBatch(
      ['token-a', 'token-b'],
      [failed('messaging/internal-error'), failed('messaging/internal-error')]
    );

    expect(outcome).toEqual({
      deliveredCount: 0,
      failedCount: 2,
      invalidTokens: [],
      ok: false,
    });
    expect(outcome.skipped).toBeUndefined();
  });

  it('counts partial success as delivered, so devices are not re-notified', () => {
    const outcome = interpretFcmBatch(
      ['token-a', 'token-b'],
      [delivered, failed('messaging/internal-error')]
    );

    expect(outcome).toEqual({
      deliveredCount: 1,
      failedCount: 1,
      invalidTokens: [],
      ok: true,
    });
    expect(outcome.skipped).toBeUndefined();
  });

  it('skips a batch whose only failures are dead tokens', () => {
    const outcome = interpretFcmBatch(
      ['token-a', 'token-b'],
      [
        failed('messaging/invalid-registration-token'),
        failed('messaging/registration-token-not-registered'),
      ]
    );

    expect(outcome).toEqual({
      deliveredCount: 0,
      failedCount: 2,
      invalidTokens: ['token-a', 'token-b'],
      ok: false,
      skipped: true,
    });
  });

  it('retries a mix of dead tokens and transient failures, deleting only the dead ones', () => {
    const outcome = interpretFcmBatch(
      ['token-a', 'token-b'],
      [
        failed('messaging/invalid-registration-token'),
        failed('messaging/internal-error'),
      ]
    );

    expect(outcome).toEqual({
      deliveredCount: 0,
      failedCount: 2,
      invalidTokens: ['token-a'],
      ok: false,
    });
    expect(outcome.skipped).toBeUndefined();
  });

  it('skips an empty batch rather than failing it', () => {
    expect(interpretFcmBatch([], [])).toEqual({
      deliveredCount: 0,
      failedCount: 0,
      invalidTokens: [],
      ok: false,
      skipped: true,
    });
  });

  it('pairs tokens with responses by index', () => {
    const outcome = interpretFcmBatch(
      ['token-a', 'token-b', 'token-c'],
      [
        failed('messaging/internal-error'),
        failed('messaging/registration-token-not-registered'),
        delivered,
      ]
    );

    expect(outcome.invalidTokens).toEqual(['token-b']);
    expect(outcome.deliveredCount).toBe(1);
    expect(outcome.failedCount).toBe(2);
    expect(outcome.ok).toBe(true);
  });

  it('counts only paired entries when there are more tokens than responses', () => {
    const outcome = interpretFcmBatch(
      ['token-a', 'token-b', 'token-c'],
      [delivered, failed('messaging/internal-error')]
    );

    // `token-c` has no response, so it is neither delivered nor failed.
    expect(outcome).toEqual({
      deliveredCount: 1,
      failedCount: 1,
      invalidTokens: [],
      ok: true,
    });
  });

  it('satisfies the queue for dead tokens, but not for a transient failure', () => {
    // The all-dead-token batch is terminal: the queue must not retry it.
    const deadTokens = interpretFcmBatch(
      ['token-a', 'token-b'],
      [
        failed('messaging/invalid-registration-token'),
        failed('messaging/registration-token-not-registered'),
      ]
    );
    expect(deadTokens.ok).toBe(false);
    expect(deadTokens.skipped).toBe(true);
    expect(isChannelSatisfied(deadTokens)).toBe(true);

    const transient = interpretFcmBatch(
      ['token-a'],
      [failed('messaging/internal-error')]
    );
    expect(transient.skipped).toBeUndefined();
    expect(isChannelSatisfied(transient)).toBe(false);
  });
});
