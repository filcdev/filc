import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import process from 'node:process';
import { eq } from 'drizzle-orm';

/**
 * The resend path with the mail transport stubbed: the call has to reach
 * `sendRawEmail`, and nothing may leave the machine.
 *
 * The transport is mocked before anything imports it, which is why the service
 * is imported lazily further down — a static import would evaluate the real
 * transport first.
 */
const sent: { subject: string; to: string }[] = [];

mock.module('#utils/notifications/providers/smtp', () => ({
  generateUnsubscribeToken: () => 'stub-token',
  renderPreviewEmail: () => Promise.resolve(''),
  sendEmail: () => Promise.resolve({ ok: true }),
  sendRawEmail: (message: { subject: string; to: string }) => {
    sent.push({ subject: message.subject, to: message.to });
    return Promise.resolve({ ok: true });
  },
}));

const hasDatabase = Boolean(process.env.CHRONOS_DATABASE_URL);

const EVENT_ID = crypto.randomUUID();
const REGISTRATION_ID = crypto.randomUUID();
const TICKET_ID = crypto.randomUUID();
const GUEST_EMAIL = 'resend.proof@example.hu';

const loadModules = async () => {
  const [database, schema, resend] = await Promise.all([
    import('#database'),
    import('#modules/events/schema'),
    import('#modules/events/utils/resend'),
  ]);
  return { ...database, ...schema, ...resend };
};

type Modules = Awaited<ReturnType<typeof loadModules>>;

describe.skipIf(!hasDatabase)('resendTicket', () => {
  let modules: Modules;

  beforeAll(async () => {
    modules = await loadModules();

    await modules.db.insert(modules.event).values({
      capacity: 10,
      category: 'open_day',
      description: [],
      endsAt: new Date('2026-06-01T17:00:00'),
      id: EVENT_ID,
      startsAt: new Date('2026-06-01T09:00:00'),
      status: 'published',
      title: 'Jegyújraküldő nap',
    });

    await modules.db.insert(modules.eventRegistration).values({
      eventId: EVENT_ID,
      guestEmail: GUEST_EMAIL,
      guestName: 'Kiss Anna',
      id: REGISTRATION_ID,
      role: 'visitor',
      status: 'confirmed',
    });

    await modules.db.insert(modules.eventTicket).values({
      id: TICKET_ID,
      registrationId: REGISTRATION_ID,
    });
  });

  afterAll(async () => {
    // Scoped: the event cascade takes its registration and ticket with it.
    await modules.db
      .delete(modules.event)
      .where(eq(modules.event.id, EVENT_ID));
  });

  it('mails the same ticket code through the stubbed transport', async () => {
    const result = await modules.resendTicket(EVENT_ID, REGISTRATION_ID);

    expect(result).toEqual({ code: TICKET_ID, ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(GUEST_EMAIL);
    expect(sent[0]?.subject).toContain('Jegyújraküldő nap');
  });

  it('reports a registration without a ticket as not found', async () => {
    const result = await modules.resendTicket(EVENT_ID, crypto.randomUUID());

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(sent).toHaveLength(1);
  });
});
