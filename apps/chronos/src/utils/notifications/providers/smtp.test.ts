import { afterAll, describe, expect, it, mock } from 'bun:test';
import { GraphMailError, type OutboundMessage } from '@filcdev/mail';

/**
 * `providers/smtp.ts` reads `#utils/environment` at module load (branding, the
 * Entra credentials) and memoises its transport, so the environment is mocked
 * before the dynamic import below. The transport itself is injected per call:
 * the first test exercises the real "nothing configured" path, the rest hand
 * in a fake so a send outcome can be driven.
 */

const BASE_URL = 'https://filc.test';

mock.module('#utils/environment', () => ({
  env: {
    authSecret: 'test-auth-secret',
    baseUrl: BASE_URL,
    entraClientId: 'entra-client',
    entraClientSecret: 'entra-secret',
    entraTenantId: 'entra-tenant',
    mailEntraClientId: undefined,
    mailEntraClientSecret: undefined,
    mailEntraTenantId: undefined,
    mailTransport: 'smtp',
    smtpFromEmail: undefined,
    smtpFromName: undefined,
    smtpHost: undefined,
  },
}));

const { generateUnsubscribeToken, renderPreviewEmail, sendEmail } =
  await import('#utils/notifications/providers/smtp');

afterAll(() => {
  mock.restore();
});

const body = { content: 'A lesson moved.', title: 'Lesson moved' };

const MANAGED_URL = `${BASE_URL}/settings/notifications?channel=email`;

/** A transport that records what the provider asked it to send. */
function fakeTransport(send?: (message: OutboundMessage) => Promise<void>) {
  const sent: OutboundMessage[] = [];
  return {
    sent,
    transport: {
      send: (message: OutboundMessage) => {
        sent.push(message);
        return send?.(message) ?? Promise.resolve();
      },
    },
  };
}

describe('sendEmail transport', () => {
  it('is skipped when no mail transport is configured', async () => {
    // No injected transport: the real resolver runs and the mocked env has no
    // SMTP host, so the channel has nothing to deliver.
    const result = await sendEmail(
      'student@example.com',
      'test',
      'en',
      body,
      ''
    );

    expect(result).toEqual({ ok: false, skipped: true });
  });

  it('surfaces a rate-limited transport retry hint', async () => {
    const retryAfterMs = 30_000;
    const { transport } = fakeTransport(() =>
      Promise.reject(new GraphMailError('Too many requests', 429, retryAfterMs))
    );

    const result = await sendEmail(
      'student@example.com',
      'test',
      'en',
      body,
      'user-1',
      undefined,
      { getTransport: () => transport }
    );

    expect(result).toEqual({ ok: false, retryAfterMs });
  });
});

describe('sendEmail links', () => {
  it('builds the manage and unsubscribe links plus the header for a real user', async () => {
    const { sent, transport } = fakeTransport();

    const result = await sendEmail(
      'student@example.com',
      'test',
      'en',
      body,
      'user-1',
      'Student',
      { getTransport: () => transport }
    );

    expect(result).toEqual({ ok: true });
    const message = sent[0];
    const token = generateUnsubscribeToken('user-1');
    expect(message?.html).toContain(MANAGED_URL);
    // The template escapes the ampersand; the header carries the URL raw.
    expect(message?.html).toContain(
      `${BASE_URL}/unsubscribe?userId=user-1&amp;token=${token}`
    );
    expect(message?.headers).toEqual({
      'List-Unsubscribe': `<${BASE_URL}/unsubscribe?userId=user-1&token=${token}>`,
    });
  });

  it('builds neither link nor header for the user-less delivery test', async () => {
    const { sent, transport } = fakeTransport();

    const result = await sendEmail(
      'student@example.com',
      'test',
      'en',
      body,
      '',
      undefined,
      { getTransport: () => transport }
    );

    expect(result).toEqual({ ok: true });
    const message = sent[0];
    expect(message?.html).not.toContain(MANAGED_URL);
    expect(message?.html).not.toContain('/unsubscribe?userId=');
    expect(message?.headers).toBeUndefined();
  });

  it('previews the sample recipient name from the catalogue and no unsubscribe link', async () => {
    const en = await renderPreviewEmail('test', 'en', body);
    const hu = await renderPreviewEmail('test', 'hu', body);

    expect(en).toContain('John Doe');
    expect(hu).toContain('Minta Felhasználó');
    expect(en).toContain(MANAGED_URL);
    expect(hu).not.toContain('/unsubscribe?userId=');
  });
});
