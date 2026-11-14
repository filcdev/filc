import { describe, expect, it } from 'bun:test';
import {
  failedChannels,
  initialChannelState,
  isChannelSatisfied,
  isJobDone,
  retryDelayMs,
} from '#utils/notifications/queue-outcome';

describe('isChannelSatisfied', () => {
  it('leaves a retryable failure pending', () => {
    expect(isChannelSatisfied({ ok: false })).toBe(false);
    expect(isJobDone({ email: false, push: true })).toBe(false);
  });

  it('satisfies a channel that delivered or had nothing to deliver', () => {
    expect(isChannelSatisfied({ ok: true })).toBe(true);
    expect(isChannelSatisfied({ ok: false, skipped: true })).toBe(true);
  });
});

describe('initialChannelState', () => {
  it('starts a disabled email channel satisfied, so it is never attempted', () => {
    expect(initialChannelState(false)).toEqual({ email: true, push: false });
  });

  it('leaves an enabled email channel to be attempted', () => {
    expect(initialChannelState(true)).toEqual({ email: false, push: false });
  });
});

describe('isJobDone', () => {
  it('is done only once every channel is satisfied', () => {
    expect(isJobDone({ email: true, push: true })).toBe(true);
    expect(isJobDone({ email: true, push: false })).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('waits for the rate-limit hint when it is longer than the backoff', () => {
    expect(retryDelayMs(500, 5000)).toBe(5000);
  });

  it('keeps the backoff when it is already the longer wait', () => {
    expect(retryDelayMs(5000, 2000)).toBe(5000);
    expect(retryDelayMs(5000)).toBe(5000);
  });
});

describe('failedChannels', () => {
  it('names only the attempted channels that have not delivered', () => {
    expect(failedChannels({ email: true, push: false })).toEqual(['push']);
    expect(failedChannels({ email: false, push: true })).toEqual(['email']);
    expect(failedChannels({ email: false, push: false })).toEqual([
      'email',
      'push',
    ]);
  });

  it('never names a channel that was satisfied from the start', () => {
    // A disabled email channel starts satisfied: the dead-letter must not
    // report it as a failed channel.
    expect(failedChannels(initialChannelState(false))).toEqual(['push']);
    expect(failedChannels({ email: true, push: true })).toEqual([]);
  });
});
