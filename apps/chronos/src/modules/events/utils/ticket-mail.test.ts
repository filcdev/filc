import { afterAll, describe, expect, it, mock } from 'bun:test';

/**
 * `ticket-mail.ts` reads `#utils/environment` at module load for the branding
 * and the public base URL, so the environment is mocked before the dynamic
 * import. The QR renderer and the sender are injected per call: the tests
 * assert exactly what the transport would be handed, and never touch a network.
 */

const BASE_URL = 'https://filc.test';

mock.module('#utils/environment', () => ({
  env: { authSecret: 'test-auth-secret', baseUrl: BASE_URL },
}));

const { buildGuestTicketEmail, sendGuestTicket, ticketUrl } = await import(
  '#modules/events/utils/ticket-mail'
);

afterAll(() => {
  mock.restore();
});

const CODE = '6a1f1d38-0f4d-4d1e-9c5b-0f0a3f6e2b11';
const QR = 'data:image/png;base64,qr-bytes';

const facts = {
  code: CODE,
  email: 'parent@example.test',
  eventId: '11111111-2222-4333-8444-555555555555',
  eventStartsAt: new Date('2027-01-20T08:00:00.000Z'),
  eventTitle: 'Open day',
  visitorName: 'Anna Parent',
};

const fakeQr = async () => QR;

describe('guest ticket mail', () => {
  it('builds the message with the QR, the link and the code', async () => {
    const message = await buildGuestTicketEmail(facts, { qr: fakeQr });

    expect(message.to).toBe(facts.email);
    expect(message.subject).toBe('Jegyed: Open day');
    expect(message.html).toContain(QR);
    expect(message.html).toContain(ticketUrl(CODE));
    expect(message.html).toContain(CODE);
    expect(message.text).toContain(CODE);
    // A guest is not a user: no unsubscribe plumbing on this mail.
    expect(message).not.toHaveProperty('headers');
  });

  it('addresses the QR with the ticket id and nothing else', async () => {
    const payloads: string[] = [];
    await buildGuestTicketEmail(facts, {
      qr: (payload) => {
        payloads.push(payload);
        return Promise.resolve(QR);
      },
    });

    expect(payloads).toEqual([CODE]);
  });

  it('reaches the injected sender with the recipient, subject and body', async () => {
    const sent: { html: string; subject: string; text: string; to: string }[] =
      [];

    const result = await sendGuestTicket(facts, {
      qr: fakeQr,
      send: (message) => {
        sent.push(message);
        return Promise.resolve({ ok: true });
      },
    });

    expect(result).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    const sentMessage = sent[0];
    expect(sentMessage?.to).toBe('parent@example.test');
    expect(sentMessage?.subject).toBe('Jegyed: Open day');
    expect(sentMessage?.html).toContain(QR);
    expect(sentMessage?.text).toContain(ticketUrl(CODE));
  });

  it('reports a failed send instead of throwing, so the registration stands', async () => {
    const result = await sendGuestTicket(facts, {
      qr: fakeQr,
      send: () => Promise.resolve({ ok: false }),
    });

    expect(result).toEqual({ ok: false });
  });

  it('swallows a renderer failure the same way', async () => {
    const result = await sendGuestTicket(facts, {
      qr: () => Promise.reject(new Error('qr renderer exploded')),
      send: () => Promise.resolve({ ok: true }),
    });

    expect(result.ok).toBe(false);
  });
});
