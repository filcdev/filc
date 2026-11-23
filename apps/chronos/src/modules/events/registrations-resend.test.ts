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
const STUDENT_REGISTRATION_ID = crypto.randomUUID();
const STUDENT_ID = crypto.randomUUID();
const TICKET_ID = crypto.randomUUID();
const GUEST_EMAIL = 'resend.proof@example.hu';
const STUDENT_EMAIL = `student.${STUDENT_ID.slice(0, 8)}@example.hu`;

const loadModules = async () => {
  const [database, authentication, schema, resend] = await Promise.all([
    import('#database'),
    import('#database/schema/authentication'),
    import('#modules/events/schema'),
    import('#modules/events/utils/resend'),
  ]);
  return { ...authentication, ...database, ...schema, ...resend };
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

    // A signed-in student, confirmed before tickets were issued for students:
    // no ticket row yet, and no guest name or address to mail.
    await modules.db.insert(modules.user).values({
      createdAt: new Date('2026-05-01T08:00:00'),
      email: STUDENT_EMAIL,
      emailVerified: true,
      id: STUDENT_ID,
      name: 'Jegyes Diák',
      updatedAt: new Date('2026-05-01T08:00:00'),
    });

    await modules.db.insert(modules.eventRegistration).values({
      eventId: EVENT_ID,
      id: STUDENT_REGISTRATION_ID,
      role: 'participant',
      status: 'confirmed',
      userId: STUDENT_ID,
    });
  });

  afterAll(async () => {
    // Scoped: the event cascade takes its registration and ticket with it.
    await modules.db
      .delete(modules.event)
      .where(eq(modules.event.id, EVENT_ID));
    await modules.db
      .delete(modules.user)
      .where(eq(modules.user.id, STUDENT_ID));
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

  it('mails a signed-in student, issuing the ticket they never had', async () => {
    const result = await modules.resendTicket(
      EVENT_ID,
      STUDENT_REGISTRATION_ID
    );

    expect(result).toMatchObject({ ok: true });
    expect(sent.at(-1)).toMatchObject({ to: STUDENT_EMAIL });

    const [ticket] = await modules.db
      .select({
        id: modules.eventTicket.id,
        sentAt: modules.eventTicket.sentAt,
      })
      .from(modules.eventTicket)
      .where(eq(modules.eventTicket.registrationId, STUDENT_REGISTRATION_ID));
    expect(ticket?.id).toBe(result.ok ? result.code : '');
    expect(ticket?.sentAt).toBeInstanceOf(Date);
  });

  it('refuses to resend a cancelled registration', async () => {
    await modules.db
      .update(modules.eventRegistration)
      .set({ status: 'cancelled' })
      .where(eq(modules.eventRegistration.id, STUDENT_REGISTRATION_ID));

    const result = await modules.resendTicket(
      EVENT_ID,
      STUDENT_REGISTRATION_ID
    );

    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });
});
