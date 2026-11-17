import { afterAll, describe, expect, it, mock } from 'bun:test';
import type { Messaging } from 'firebase-admin/messaging';

/**
 * `providers/fcm.ts` reads `#database` (which connects a pool) and
 * `#utils/environment` at module load, so both are mocked before the dynamic
 * import below. `sendPush` takes its messaging client and token store as an
 * optional argument, so the tests themselves touch neither.
 */

mock.module('#database', () => ({ db: {} }));
mock.module('#utils/environment', () => ({
  env: { fcmCredentials: undefined, fcmProjectId: undefined },
}));

const { sendPush } = await import('#utils/notifications/providers/fcm');

afterAll(() => {
  mock.restore();
});

type SendResponse = { error?: { code?: string }; success: boolean };

const TOKENS = ['token-a', 'token-b'];

/**
 * A fake token store and messaging client. `deleteError` makes the cleanup
 * throw after recording the tokens, which is the case where a delivered push
 * must not be turned into a retry.
 */
function fakeDeps(options: {
  deleteError?: Error;
  responses: SendResponse[];
  tokens?: string[];
}) {
  const deleted: string[][] = [];
  const sent: { tokens: string[] }[] = [];
  const deps = {
    messaging: {
      sendEachForMulticast: (message: { tokens: string[] }) => {
        sent.push(message);
        return Promise.resolve({ responses: options.responses });
      },
    } as unknown as Messaging,
    store: {
      deleteTokens: (tokens: string[]) => {
        deleted.push(tokens);
        return options.deleteError
          ? Promise.reject(options.deleteError)
          : Promise.resolve();
      },
      listTokens: () => Promise.resolve(options.tokens ?? TOKENS),
    },
  };
  return { deleted, deps, sent };
}

describe('sendPush', () => {
  it('deletes exactly the dead tokens and is satisfied', async () => {
    const { deps, deleted, sent } = fakeDeps({
      responses: [
        {
          error: { code: 'messaging/registration-token-not-registered' },
          success: false,
        },
        {
          error: { code: 'messaging/invalid-registration-token' },
          success: false,
        },
      ],
    });

    const result = await sendPush('user-1', 'Title', 'Body', deps);

    expect(result).toEqual({ ok: false, skipped: true });
    expect(sent[0]?.tokens).toEqual(['token-a', 'token-b']);
    expect(deleted).toEqual([['token-a', 'token-b']]);
  });

  it('leaves a transient failure unsatisfied so the queue retries it', async () => {
    const { deps, deleted } = fakeDeps({
      responses: [
        { error: { code: 'messaging/internal-error' }, success: false },
      ],
      tokens: ['token-a'],
    });

    const result = await sendPush('user-1', 'Title', 'Body', deps);

    expect(result).toEqual({ ok: false });
    expect(result.skipped).toBeUndefined();
    expect(deleted).toEqual([]);
  });

  it('keeps a delivered push satisfied when the token cleanup throws', async () => {
    const { deps, deleted } = fakeDeps({
      deleteError: new Error('delete failed'),
      responses: [
        { success: true },
        {
          error: { code: 'messaging/registration-token-not-registered' },
          success: false,
        },
      ],
    });

    const result = await sendPush('user-1', 'Title', 'Body', deps);

    expect(result).toEqual({ ok: true });
    // The cleanup ran and only targeted the dead token; its failure is logged
    // and swallowed, never a reason to re-send to the delivered device.
    expect(deleted).toEqual([['token-b']]);
  });

  it('is satisfied on a partial success and keeps the delivered tokens', async () => {
    const { deps, deleted } = fakeDeps({
      responses: [
        { success: true },
        {
          error: { code: 'messaging/registration-token-not-registered' },
          success: false,
        },
      ],
    });

    const result = await sendPush('user-1', 'Title', 'Body', deps);

    expect(result).toEqual({ ok: true });
    expect(deleted).toEqual([['token-b']]);
  });
});
