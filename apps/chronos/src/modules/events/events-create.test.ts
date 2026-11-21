import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';
import type { EventCreateInput } from '@filcdev/api/domains/events/event';
import { eq, inArray } from 'drizzle-orm';
import type { ChronosContext } from '#_types/globals';

/**
 * `events.create` over the real handler, because the default lives in it: an
 * event created without `status` is published, and an explicit `draft` is
 * honoured. The database tests skip when the app has no database configured,
 * and the modules are imported lazily because `#database` parses the env at
 * import time.
 */
const hasDatabase = Boolean(process.env.CHRONOS_DATABASE_URL);

const ORGANIZER_ID = crypto.randomUUID();
const ORGANIZER_EMAIL = `organizer.${ORGANIZER_ID.slice(0, 8)}@example.hu`;

const loadModules = async () => {
  const [database, authentication, schema, events, activityLog, authorization] =
    await Promise.all([
      import('#database'),
      import('#database/schema/authentication'),
      import('#modules/events/schema'),
      import('#modules/events/events'),
      import('#modules/activity-log/schema'),
      import('#utils/authorization'),
    ]);
  return {
    ...activityLog,
    ...authentication,
    ...authorization,
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

const eventInput = (): EventCreateInput => ({
  category: 'open_day' as const,
  description: [],
  endsAt: new Date('2026-08-01T17:00:00'),
  startsAt: new Date('2026-08-01T09:00:00'),
  title: 'Publikus nap',
});

describe.skipIf(!hasDatabase)('events.create', () => {
  let modules: Modules;
  const createdIds: string[] = [];

  const create = (input: EventCreateInput) =>
    modules.createEvent
      .callable({ context: contextFor(ORGANIZER_ID) })(input)
      .then((created) => {
        createdIds.push(created.id);
        return created;
      });

  beforeAll(async () => {
    modules = await loadModules();
    // The guard reads the in-memory role table, which the server fills at boot.
    await modules.initializeRBAC();

    await modules.db.insert(modules.user).values({
      createdAt: new Date(),
      email: ORGANIZER_EMAIL,
      emailVerified: true,
      id: ORGANIZER_ID,
      name: 'Szervező Tanár',
      roles: ['admin'],
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (!modules) {
      return;
    }
    if (createdIds.length > 0) {
      await modules.db
        .delete(modules.activityLog)
        .where(inArray(modules.activityLog.entityId, createdIds));
      await modules.db
        .delete(modules.event)
        .where(inArray(modules.event.id, createdIds));
    }
    await modules.db
      .delete(modules.user)
      .where(eq(modules.user.id, ORGANIZER_ID));
  });

  it('publishes an event created without a status', async () => {
    const created = await create(eventInput());

    expect(created.status).toBe('published');
  });

  it('keeps an explicitly drafted event a draft', async () => {
    const created = await create({ ...eventInput(), status: 'draft' });

    expect(created.status).toBe('draft');
  });
});
