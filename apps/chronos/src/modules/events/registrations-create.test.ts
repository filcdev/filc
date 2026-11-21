import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';
import { and, eq, inArray } from 'drizzle-orm';
import type { ChronosContext } from '#_types/globals';

/**
 * `registrations.create` over the real handler, because the helper cap is a
 * write-time rule: an application is refused once the confirmed helpers fill
 * the event's `helperCapacity`, and a pending application never takes a slot.
 * The database tests skip when the app has no database configured, and the
 * modules are imported lazily because `#database` parses the env at import
 * time.
 */
const hasDatabase = Boolean(process.env.CHRONOS_DATABASE_URL);

const EVENT_ID = crypto.randomUUID();
const CONFIRMED_ID = crypto.randomUUID();
const FIRST_APPLICANT_ID = crypto.randomUUID();
const SECOND_APPLICANT_ID = crypto.randomUUID();
const STUDENT_IDS = [CONFIRMED_ID, FIRST_APPLICANT_ID, SECOND_APPLICANT_ID];
const EMAIL_PREFIX = EVENT_ID.slice(0, 8);

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

describe.skipIf(!hasDatabase)('registrations.create and the helper cap', () => {
  let modules: Modules;

  const apply = (userId: string) =>
    modules.createRegistration.callable({ context: contextFor(userId) })({
      id: EVENT_ID,
      role: 'helper',
    });

  beforeAll(async () => {
    modules = await loadModules();
    const { db } = modules;

    await db.insert(modules.event).values({
      category: 'open_day',
      description: [],
      endsAt: at(17),
      helperCapacity: 2,
      helperRegistrationEnabled: true,
      id: EVENT_ID,
      startsAt: at(9),
      status: 'published',
      title: 'Segítői létszám',
    });

    await db.insert(modules.user).values(
      STUDENT_IDS.map((id, index) => ({
        createdAt: at(8),
        email: `helper.application.${index}.${EMAIL_PREFIX}@example.hu`,
        emailVerified: true,
        id,
        name: `Applicant ${index}`,
        updatedAt: at(8),
      }))
    );

    await db.insert(modules.eventRegistration).values({
      eventId: EVENT_ID,
      role: 'helper',
      status: 'confirmed',
      userId: CONFIRMED_ID,
    });
  });

  afterAll(async () => {
    if (!modules) {
      return;
    }
    // The create handler writes an audit row; the event cascade takes the
    // registrations with it.
    await modules.db
      .delete(modules.activityLog)
      .where(eq(modules.activityLog.entityId, EVENT_ID));
    await modules.db
      .delete(modules.event)
      .where(eq(modules.event.id, EVENT_ID));
    await modules.db
      .delete(modules.user)
      .where(inArray(modules.user.id, STUDENT_IDS));
  });

  it('accepts an application while a confirmed slot is free', async () => {
    const created = await apply(FIRST_APPLICANT_ID);

    expect(created.role).toBe('helper');
    expect(created.status).toBe('pending');
  });

  it('refuses an application once the confirmed helpers fill the cap', async () => {
    await modules.db
      .update(modules.event)
      .set({ helperCapacity: 1 })
      .where(eq(modules.event.id, EVENT_ID));

    await expect(apply(SECOND_APPLICANT_ID)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'The helper limit has been reached',
    });

    const [row] = await modules.db
      .select({ id: modules.eventRegistration.id })
      .from(modules.eventRegistration)
      .where(
        and(
          eq(modules.eventRegistration.eventId, EVENT_ID),
          eq(modules.eventRegistration.userId, SECOND_APPLICANT_ID)
        )
      );
    expect(row).toBeUndefined();
  });
});
