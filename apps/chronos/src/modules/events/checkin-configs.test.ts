import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';
import type { EventCheckinRule } from '@filcdev/api/domains/events/rules';
import { eq, inArray } from 'drizzle-orm';
import type { ChronosContext } from '#_types/globals';

/**
 * The door-config endpoints over the real handlers and the real database. The
 * partial unique indexes are the point of two of these cases: a plain unique
 * would let an event stack defaults, and the upsert would quietly create a
 * second row per helper.
 */
const hasDatabase = Boolean(process.env.CHRONOS_DATABASE_URL);

const ORGANIZER_ID = crypto.randomUUID();
const HELPER_A_ID = crypto.randomUUID();
const HELPER_B_ID = crypto.randomUUID();
const PENDING_HELPER_ID = crypto.randomUUID();

const loadModules = async () => {
  const [
    database,
    authentication,
    schema,
    events,
    checkinConfigs,
    activityLog,
    authorization,
  ] = await Promise.all([
    import('#database'),
    import('#database/schema/authentication'),
    import('#modules/events/schema'),
    import('#modules/events/events'),
    import('#modules/events/checkin-configs'),
    import('#modules/activity-log/schema'),
    import('#utils/authorization'),
  ]);
  return {
    ...activityLog,
    ...authentication,
    ...authorization,
    ...checkinConfigs,
    ...database,
    ...events,
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

/** A complete rule list: the catch-all is the whole list here. */
const catchAll = (
  action: 'allow' | 'deny',
  id: string = crypto.randomUUID()
): EventCheckinRule => ({
  action,
  id,
  message: action === 'deny' ? 'Nem léphet be' : '',
  show: { email: false, fieldIds: [], name: true },
  when: null,
});

describe.skipIf(!hasDatabase)('events.checkinConfigs', () => {
  let modules: Modules;
  let eventId: string;
  const context = contextFor(ORGANIZER_ID);

  const upsert = (body: {
    id: string;
    rules: EventCheckinRule[];
    userId: string | null;
  }) => modules.upsertCheckinConfig.callable({ context })(body);

  const list = () =>
    modules.listCheckinConfigs.callable({ context })({ id: eventId });

  const reset = (userId: string) =>
    modules.deleteCheckinConfig.callable({ context })({ id: eventId, userId });

  beforeAll(async () => {
    modules = await loadModules();
    // The guard reads the in-memory role table, which the server fills at boot.
    await modules.initializeRBAC();

    await modules.db.insert(modules.user).values([
      {
        createdAt: new Date(),
        email: `organizer.${ORGANIZER_ID.slice(0, 8)}@example.hu`,
        emailVerified: true,
        id: ORGANIZER_ID,
        name: 'Szervező Tanár',
        roles: ['admin'],
        updatedAt: new Date(),
      },
      {
        createdAt: new Date(),
        email: `helper.a.${HELPER_A_ID.slice(0, 8)}@example.hu`,
        emailVerified: true,
        id: HELPER_A_ID,
        name: 'Segítő A',
        roles: ['student'],
        updatedAt: new Date(),
      },
      {
        createdAt: new Date(),
        email: `helper.b.${HELPER_B_ID.slice(0, 8)}@example.hu`,
        emailVerified: true,
        id: HELPER_B_ID,
        name: 'Segítő B',
        roles: ['student'],
        updatedAt: new Date(),
      },
      {
        createdAt: new Date(),
        email: `helper.p.${PENDING_HELPER_ID.slice(0, 8)}@example.hu`,
        emailVerified: true,
        id: PENDING_HELPER_ID,
        name: 'Függő Segítő',
        roles: ['student'],
        updatedAt: new Date(),
      },
    ]);

    const created = await modules.createEvent.callable({ context })({
      category: 'open_day',
      description: [],
      endsAt: new Date('2026-08-01T17:00:00'),
      startsAt: new Date('2026-08-01T09:00:00'),
      title: 'Szkenneres beléptetés',
    });
    eventId = created.id;

    await modules.db.insert(modules.eventRegistration).values([
      {
        eventId,
        role: 'helper',
        status: 'confirmed',
        userId: HELPER_A_ID,
      },
      {
        eventId,
        role: 'helper',
        status: 'confirmed',
        userId: HELPER_B_ID,
      },
      {
        eventId,
        role: 'helper',
        status: 'pending',
        userId: PENDING_HELPER_ID,
      },
    ]);
  });

  afterAll(async () => {
    if (!(modules && eventId)) {
      return;
    }
    await modules.db
      .delete(modules.activityLog)
      .where(inArray(modules.activityLog.entityId, [eventId]));
    await modules.db.delete(modules.event).where(eq(modules.event.id, eventId));
    await modules.db
      .delete(modules.user)
      .where(
        inArray(modules.user.id, [
          ORGANIZER_ID,
          HELPER_A_ID,
          HELPER_B_ID,
          PENDING_HELPER_ID,
        ])
      );
  });

  it('starts a created event with one default config', async () => {
    const payload = await list();

    expect(payload.total).toBe(1);
    expect(payload.items[0]).toMatchObject({ userId: null });
    expect(payload.items[0]?.userName).toBeNull();
    expect(payload.items[0]?.rules).toHaveLength(1);
    expect(payload.items[0]?.rules[0]?.action).toBe('allow');
    expect(payload.items[0]?.rules[0]?.when).toBeNull();
  });

  it('upserts a helper override without stacking rows', async () => {
    const denied = await upsert({
      id: eventId,
      rules: [catchAll('deny')],
      userId: HELPER_A_ID,
    });

    expect(denied.userId).toBe(HELPER_A_ID);
    expect(denied.userName).toBe('Segítő A');
    expect(denied.rules[0]?.action).toBe('deny');

    // Saving the same helper again updates the row the partial unique index
    // names instead of inserting a second one.
    const allowed = await upsert({
      id: eventId,
      rules: [catchAll('allow')],
      userId: HELPER_A_ID,
    });
    expect(allowed.rules[0]?.action).toBe('allow');
    expect(allowed.id).toBe(denied.id);

    const payload = await list();
    expect(payload.total).toBe(2);
    expect(payload.items[0]?.userId).toBeNull();
  });

  it('refuses a config for a helper who is not approved', async () => {
    await expect(
      upsert({
        id: eventId,
        rules: [catchAll('allow')],
        userId: PENDING_HELPER_ID,
      })
    ).rejects.toThrow();
  });

  it('makes a second default and a second config for one helper impossible', async () => {
    // Bypass the upsert on purpose: the database itself has to refuse both.
    await expect(
      modules.db
        .insert(modules.eventCheckinConfig)
        .values({
          eventId,
          rules: [catchAll('allow')],
          userId: null,
        })
        .execute()
    ).rejects.toThrow();

    await expect(
      modules.db
        .insert(modules.eventCheckinConfig)
        .values({
          eventId,
          rules: [catchAll('deny')],
          userId: HELPER_A_ID,
        })
        .execute()
    ).rejects.toThrow();
  });

  it('deletes an override and leaves the helper on the default', async () => {
    const deleted = await reset(HELPER_A_ID);
    expect(deleted.id).toBeTruthy();

    const payload = await list();
    expect(payload.total).toBe(1);
    expect(payload.items.every((item) => item.userId === null)).toBe(true);

    // A second reset of the same helper is a missing row, not a silent success.
    await expect(reset(HELPER_A_ID)).rejects.toThrow();
  });

  it('keeps the default when another helper has their own rules', async () => {
    const override = await upsert({
      id: eventId,
      rules: [catchAll('deny')],
      userId: HELPER_B_ID,
    });
    expect(override.userName).toBe('Segítő B');

    const payload = await list();
    expect(payload.total).toBe(2);
    expect(payload.items.find((item) => item.userId === null)).toBeTruthy();
  });
});
