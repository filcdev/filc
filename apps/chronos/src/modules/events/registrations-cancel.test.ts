import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';
import { eq } from 'drizzle-orm';
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
const HELPER_ID = crypto.randomUUID();
const PARTICIPANT_ID = crypto.randomUUID();
const STRANGER_ID = crypto.randomUUID();
const HELPER_EMAIL = `helper.${HELPER_ID.slice(0, 8)}@example.hu`;
const PARTICIPANT_EMAIL = `participant.${PARTICIPANT_ID.slice(0, 8)}@example.hu`;
const STRANGER_EMAIL = `stranger.${STRANGER_ID.slice(0, 8)}@example.hu`;

const loadModules = async () => {
  const [database, authentication, schema, registrations, activityLog] =
    await Promise.all([
      import('#database'),
      import('#database/schema/authentication'),
      import('#modules/events/schema'),
      import('#modules/events/registrations'),
      import('#modules/activity-log/schema'),
    ]);
  return {
    ...activityLog,
    ...authentication,
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

  const cancel = (userId: string, registrationId: string) =>
    modules.cancelRegistration.callable({ context: contextFor(userId) })({
      id: EVENT_ID,
      registrationId,
    });

  beforeAll(async () => {
    modules = await loadModules();
    const { db } = modules;

    await db.insert(modules.event).values({
      capacity: 5,
      category: 'open_day',
      description: [],
      endsAt: new Date('2026-07-01T17:00:00'),
      id: EVENT_ID,
      registrationEnabled: true,
      startsAt: new Date('2026-07-01T09:00:00'),
      status: 'published',
      title: 'Cancel proof',
    });

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
      ])
      .returning({
        id: modules.eventRegistration.id,
        userId: modules.eventRegistration.userId,
      });
    const idFor = (userId: string) =>
      rows.find((row) => row.userId === userId)?.id ?? '';
    helperRegistrationId = idFor(HELPER_ID);
    participantRegistrationId = idFor(PARTICIPANT_ID);
    strangerRegistrationId = idFor(STRANGER_ID);
  });

  afterAll(async () => {
    if (!modules) {
      return;
    }
    // The event cascade takes its registrations with it; the audit rows the
    // handler wrote reference the users, not the event.
    await modules.db
      .delete(modules.activityLog)
      .where(eq(modules.activityLog.entityId, EVENT_ID));
    await modules.db
      .delete(modules.event)
      .where(eq(modules.event.id, EVENT_ID));
    await modules.db.delete(modules.user).where(eq(modules.user.id, HELPER_ID));
    await modules.db
      .delete(modules.user)
      .where(eq(modules.user.id, PARTICIPANT_ID));
    await modules.db
      .delete(modules.user)
      .where(eq(modules.user.id, STRANGER_ID));
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
});
