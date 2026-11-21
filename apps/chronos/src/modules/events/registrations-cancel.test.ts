import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';
import { eq, inArray } from 'drizzle-orm';
import type { ChronosContext } from '#_types/globals';

/**
 * `registrations.cancel` over the real handler, because the rule lives in its
 * `where` clause: a student withdraws their own confirmed place *or* their own
 * pending helper application, and nothing else. The database tests skip when
 * the app has no database configured, and the modules are imported lazily
 * because `#database` parses the env at import time.
 */
const hasDatabase = Boolean(process.env.CHRONOS_DATABASE_URL);

const EVENT_ID = crypto.randomUUID();
/** A second event, so the admin owner can hold a confirmed row beside the pending one. */
const ADMIN_EVENT_ID = crypto.randomUUID();
const HELPER_ID = crypto.randomUUID();
const PARTICIPANT_ID = crypto.randomUUID();
const STRANGER_ID = crypto.randomUUID();
const ADMIN_OWNER_ID = crypto.randomUUID();
const ADMIN_STRANGER_ID = crypto.randomUUID();
const HELPER_EMAIL = `helper.${HELPER_ID.slice(0, 8)}@example.hu`;
const PARTICIPANT_EMAIL = `participant.${PARTICIPANT_ID.slice(0, 8)}@example.hu`;
const STRANGER_EMAIL = `stranger.${STRANGER_ID.slice(0, 8)}@example.hu`;
const ADMIN_OWNER_EMAIL = `admin.owner.${ADMIN_OWNER_ID.slice(0, 8)}@example.hu`;
const ADMIN_STRANGER_EMAIL = `admin.stranger.${ADMIN_STRANGER_ID.slice(0, 8)}@example.hu`;

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

describe.skipIf(!hasDatabase)('registrations.cancel', () => {
  let modules: Modules;
  let helperRegistrationId: string;
  let participantRegistrationId: string;
  let strangerRegistrationId: string;
  let adminPendingRegistrationId: string;
  let adminConfirmedRegistrationId: string;

  const cancel = (userId: string, registrationId: string, eventId = EVENT_ID) =>
    modules.cancelRegistration.callable({ context: contextFor(userId) })({
      id: eventId,
      registrationId,
    });

  beforeAll(async () => {
    modules = await loadModules();
    const { db } = modules;

    // The manager branch reads the in-memory role table, which the server
    // fills at boot.
    await modules.initializeRBAC();

    await db.insert(modules.event).values([
      {
        capacity: 5,
        category: 'open_day',
        description: [],
        endsAt: new Date('2026-07-01T17:00:00'),
        id: EVENT_ID,
        registrationEnabled: true,
        startsAt: new Date('2026-07-01T09:00:00'),
        status: 'published',
        title: 'Cancel proof',
      },
      {
        capacity: 5,
        category: 'open_day',
        description: [],
        endsAt: new Date('2026-07-02T17:00:00'),
        id: ADMIN_EVENT_ID,
        registrationEnabled: true,
        startsAt: new Date('2026-07-02T09:00:00'),
        status: 'published',
        title: 'Cancel proof for an organizer',
      },
    ]);

    await db.insert(modules.user).values([
      {
        createdAt: new Date(),
        email: HELPER_EMAIL,
        emailVerified: true,
        id: HELPER_ID,
        name: 'Segítő Hallgató',
        roles: [],
        updatedAt: new Date(),
      },
      {
        createdAt: new Date(),
        email: PARTICIPANT_EMAIL,
        emailVerified: true,
        id: PARTICIPANT_ID,
        name: 'Résztvevő Hallgató',
        roles: [],
        updatedAt: new Date(),
      },
      {
        createdAt: new Date(),
        email: STRANGER_EMAIL,
        emailVerified: true,
        id: STRANGER_ID,
        name: 'Idegen Hallgató',
        roles: [],
        updatedAt: new Date(),
      },
      {
        createdAt: new Date(),
        email: ADMIN_OWNER_EMAIL,
        emailVerified: true,
        id: ADMIN_OWNER_ID,
        name: 'Szervező Segítő',
        roles: ['admin'],
        updatedAt: new Date(),
      },
      {
        createdAt: new Date(),
        email: ADMIN_STRANGER_EMAIL,
        emailVerified: true,
        id: ADMIN_STRANGER_ID,
        name: 'Szervező Tanár',
        roles: ['admin'],
        updatedAt: new Date(),
      },
    ]);

    const rows = await db
      .insert(modules.eventRegistration)
      .values([
        {
          eventId: EVENT_ID,
          role: 'helper',
          status: 'pending',
          userId: HELPER_ID,
        },
        {
          eventId: EVENT_ID,
          role: 'participant',
          status: 'confirmed',
          userId: PARTICIPANT_ID,
        },
        {
          eventId: EVENT_ID,
          role: 'helper',
          status: 'pending',
          userId: STRANGER_ID,
        },
        {
          eventId: EVENT_ID,
          role: 'helper',
          status: 'pending',
          userId: ADMIN_OWNER_ID,
        },
        {
          eventId: ADMIN_EVENT_ID,
          role: 'participant',
          status: 'confirmed',
          userId: ADMIN_OWNER_ID,
        },
      ])
      .returning({
        eventId: modules.eventRegistration.eventId,
        id: modules.eventRegistration.id,
        userId: modules.eventRegistration.userId,
      });
    const idFor = (eventId: string, userId: string) =>
      rows.find((row) => row.eventId === eventId && row.userId === userId)
        ?.id ?? '';
    helperRegistrationId = idFor(EVENT_ID, HELPER_ID);
    participantRegistrationId = idFor(EVENT_ID, PARTICIPANT_ID);
    strangerRegistrationId = idFor(EVENT_ID, STRANGER_ID);
    adminPendingRegistrationId = idFor(EVENT_ID, ADMIN_OWNER_ID);
    adminConfirmedRegistrationId = idFor(ADMIN_EVENT_ID, ADMIN_OWNER_ID);
  });

  afterAll(async () => {
    if (!modules) {
      return;
    }
    // The event cascade takes its registrations with it; the audit rows the
    // handler wrote reference the users, not the event.
    await modules.db
      .delete(modules.activityLog)
      .where(inArray(modules.activityLog.entityId, [EVENT_ID, ADMIN_EVENT_ID]));
    await modules.db
      .delete(modules.event)
      .where(inArray(modules.event.id, [EVENT_ID, ADMIN_EVENT_ID]));
    await modules.db
      .delete(modules.user)
      .where(
        inArray(modules.user.id, [
          HELPER_ID,
          PARTICIPANT_ID,
          STRANGER_ID,
          ADMIN_OWNER_ID,
          ADMIN_STRANGER_ID,
        ])
      );
  });

  it('lets a pending helper withdraw their own application, once', async () => {
    expect(await cancel(HELPER_ID, helperRegistrationId)).toEqual({
      id: helperRegistrationId,
    });

    const [row] = await modules.db
      .select({ status: modules.eventRegistration.status })
      .from(modules.eventRegistration)
      .where(eq(modules.eventRegistration.id, helperRegistrationId));
    expect(row?.status).toBe('cancelled');

    await expect(cancel(HELPER_ID, helperRegistrationId)).rejects.toMatchObject(
      { code: 'NOT_FOUND' }
    );
  });

  it('still lets a confirmed participant cancel their place', async () => {
    expect(await cancel(PARTICIPANT_ID, participantRegistrationId)).toEqual({
      id: participantRegistrationId,
    });
  });

  it("answers 404 for another student's pending row", async () => {
    await expect(
      cancel(PARTICIPANT_ID, strangerRegistrationId)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const [row] = await modules.db
      .select({ status: modules.eventRegistration.status })
      .from(modules.eventRegistration)
      .where(eq(modules.eventRegistration.id, strangerRegistrationId));
    expect(row?.status).toBe('pending');
  });

  it('lets an admin withdraw their own pending application', async () => {
    expect(await cancel(ADMIN_OWNER_ID, adminPendingRegistrationId)).toEqual({
      id: adminPendingRegistrationId,
    });

    const [row] = await modules.db
      .select({ status: modules.eventRegistration.status })
      .from(modules.eventRegistration)
      .where(eq(modules.eventRegistration.id, adminPendingRegistrationId));
    expect(row?.status).toBe('cancelled');
  });

  it('lets an admin withdraw their own confirmed place', async () => {
    expect(
      await cancel(ADMIN_OWNER_ID, adminConfirmedRegistrationId, ADMIN_EVENT_ID)
    ).toEqual({ id: adminConfirmedRegistrationId });

    const [row] = await modules.db
      .select({ status: modules.eventRegistration.status })
      .from(modules.eventRegistration)
      .where(eq(modules.eventRegistration.id, adminConfirmedRegistrationId));
    expect(row?.status).toBe('cancelled');
  });

  it("answers 404 for an admin cancelling someone else's pending row", async () => {
    await expect(
      cancel(ADMIN_STRANGER_ID, strangerRegistrationId)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const [row] = await modules.db
      .select({ status: modules.eventRegistration.status })
      .from(modules.eventRegistration)
      .where(eq(modules.eventRegistration.id, strangerRegistrationId));
    expect(row?.status).toBe('pending');
  });

  it('answers 404 for an owner cancelling a cancelled row again', async () => {
    await expect(
      cancel(ADMIN_OWNER_ID, adminConfirmedRegistrationId, ADMIN_EVENT_ID)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
