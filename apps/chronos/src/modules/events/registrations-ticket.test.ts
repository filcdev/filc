import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import process from 'node:process';
import { eq, inArray } from 'drizzle-orm';
import type { ChronosContext } from '#_types/globals';

/**
 * Ticket issuance is role-agnostic: a participant gets one when their signup is
 * confirmed, a helper when an organizer approves them, and both are mailed
 * through the same transactional transport. The transport is stubbed before
 * anything imports it, and the modules are loaded lazily because `#database`
 * parses the env at import time.
 */
const sent: { subject: string; to: string }[] = [];
/** Lets one test make the transport fail without touching the others. */
let mailFails = false;

mock.module('#utils/notifications/providers/smtp', () => ({
  generateUnsubscribeToken: () => 'stub-token',
  renderPreviewEmail: () => Promise.resolve(''),
  sendEmail: () => Promise.resolve({ ok: true }),
  sendRawEmail: (message: { subject: string; to: string }) => {
    sent.push({ subject: message.subject, to: message.to });
    if (mailFails) {
      throw new Error('smtp is down');
    }
    return Promise.resolve({ ok: true });
  },
}));

const hasDatabase = Boolean(process.env.CHRONOS_DATABASE_URL);

const EVENT_ID = crypto.randomUUID();
const STUDENT_ID = crypto.randomUUID();
const SECOND_STUDENT_ID = crypto.randomUUID();
const HELPER_ID = crypto.randomUUID();
const ADMIN_ID = crypto.randomUUID();
const EMAIL_PREFIX = EVENT_ID.slice(0, 8);
const STUDENT_EMAIL = `student.ticket.${EMAIL_PREFIX}@example.hu`;
const SECOND_STUDENT_EMAIL = `student.failed.${EMAIL_PREFIX}@example.hu`;
const HELPER_EMAIL = `helper.ticket.${EMAIL_PREFIX}@example.hu`;
const USER_IDS = [STUDENT_ID, SECOND_STUDENT_ID, HELPER_ID, ADMIN_ID];

const loadModules = async () => {
  const [
    database,
    authentication,
    schema,
    registrations,
    activityLog,
    authorization,
  ] = await Promise.all([
    import('#database'),
    import('#database/schema/authentication'),
    import('#modules/events/schema'),
    import('#modules/events/registrations'),
    import('#modules/activity-log/schema'),
    import('#utils/authorization'),
  ]);
  return {
    ...activityLog,
    ...authentication,
    ...authorization,
    ...database,
    ...registrations,
    ...schema,
  };
};

type Modules = Awaited<ReturnType<typeof loadModules>>;

/** The context `resolveCaller` would hand the handler for a signed-in user. */
const contextFor = (userId: string): ChronosContext =>
  ({
    anonymousId: null,
    clientIp: '127.0.0.1',
    reqHeaders: new Headers(),
    requestId: crypto.randomUUID(),
    resHeaders: new Headers(),
    session: { id: crypto.randomUUID(), userId },
    user: { id: userId },
  }) as unknown as ChronosContext;

const at = (hour: number) => new Date(2026, 4, 5, hour, 0, 0);

describe.skipIf(!hasDatabase)('registration tickets', () => {
  let modules: Modules;

  const register = (userId: string, role: 'helper' | 'participant') =>
    modules.createRegistration.callable({ context: contextFor(userId) })({
      id: EVENT_ID,
      role,
    });

  const ticketOf = async (registrationId: string) => {
    const [ticket] = await modules.db
      .select()
      .from(modules.eventTicket)
      .where(eq(modules.eventTicket.registrationId, registrationId));
    return ticket;
  };

  beforeAll(async () => {
    modules = await loadModules();
    const { db } = modules;

    await modules.initializeRBAC();

    await db.insert(modules.event).values({
      capacity: 10,
      category: 'open_day',
      description: [],
      endsAt: at(17),
      helperRegistrationEnabled: true,
      id: EVENT_ID,
      startsAt: at(9),
      status: 'published',
      title: 'Jegy mindenkinek',
    });

    await db.insert(modules.user).values([
      {
        createdAt: at(8),
        email: STUDENT_EMAIL,
        emailVerified: true,
        id: STUDENT_ID,
        name: 'Jegyes Diák',
        roles: [],
        updatedAt: at(8),
      },
      {
        createdAt: at(8),
        email: SECOND_STUDENT_EMAIL,
        emailVerified: true,
        id: SECOND_STUDENT_ID,
        name: 'Sikertelen Diák',
        roles: [],
        updatedAt: at(8),
      },
      {
        createdAt: at(8),
        email: HELPER_EMAIL,
        emailVerified: true,
        id: HELPER_ID,
        name: 'Jegyes Segítő',
        roles: [],
        updatedAt: at(8),
      },
      {
        createdAt: at(8),
        email: `admin.ticket.${EMAIL_PREFIX}@example.hu`,
        emailVerified: true,
        id: ADMIN_ID,
        name: 'Szervező Tanár',
        roles: ['admin'],
        updatedAt: at(8),
      },
    ]);
  });

  afterAll(async () => {
    if (!modules) {
      return;
    }
    // The create and decide handlers write audit rows; the event cascade takes
    // its registrations and tickets with it.
    await modules.db
      .delete(modules.activityLog)
      .where(eq(modules.activityLog.entityId, EVENT_ID));
    await modules.db
      .delete(modules.event)
      .where(eq(modules.event.id, EVENT_ID));
    await modules.db
      .delete(modules.user)
      .where(inArray(modules.user.id, USER_IDS));
  });

  it('issues and mails a ticket when a student registers', async () => {
    const registration = await register(STUDENT_ID, 'participant');

    expect(registration.status).toBe('confirmed');

    const ticket = await ticketOf(registration.id);
    expect(ticket).toBeDefined();
    expect(ticket?.sentAt).toBeInstanceOf(Date);
    expect(sent.at(-1)).toMatchObject({ to: STUDENT_EMAIL });
  });

  it('issues and mails a ticket when an organizer approves a helper', async () => {
    const pending = await register(HELPER_ID, 'helper');
    expect(pending.status).toBe('pending');
    // A pending helper is not coming yet, so nothing is mailed at signup.
    expect(await ticketOf(pending.id)).toBeUndefined();
    const mailCountWhilePending = sent.length;

    const approved = await modules.decideRegistration.callable({
      context: contextFor(ADMIN_ID),
    })({
      decision: 'approve',
      id: EVENT_ID,
      registrationId: pending.id,
    });

    expect(approved.status).toBe('confirmed');
    const ticket = await ticketOf(approved.id);
    expect(ticket).toBeDefined();
    expect(ticket?.sentAt).toBeInstanceOf(Date);
    expect(sent).toHaveLength(mailCountWhilePending + 1);
    expect(sent.at(-1)).toMatchObject({ to: HELPER_EMAIL });
  });

  it('leaves sent_at null when the transport does not take the mail', async () => {
    mailFails = true;
    try {
      const registration = await register(SECOND_STUDENT_ID, 'participant');

      const ticket = await ticketOf(registration.id);
      // The registration and its ticket stand; only the delivery record does not.
      expect(ticket).toBeDefined();
      expect(ticket?.sentAt).toBeNull();
    } finally {
      mailFails = false;
    }
  });
});
