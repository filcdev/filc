import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';
import { eq } from 'drizzle-orm';

/**
 * These tests want a real Postgres, so they skip when the app has no database
 * configured. The modules are imported lazily: `#database` parses the env at
 * import time, and a skipped suite must not crash on a CI runner that has no
 * `CHRONOS_DATABASE_URL` at all.
 */
const hasDatabase = Boolean(process.env.CHRONOS_DATABASE_URL);

const loadModules = async () => {
  const [database, authentication, schema, participants, stats] =
    await Promise.all([
      import('#database'),
      import('#database/schema/authentication'),
      import('#modules/events/schema'),
      import('#modules/events/utils/participants'),
      import('#modules/events/utils/stats'),
    ]);
  return {
    ...database,
    ...authentication,
    ...schema,
    ...participants,
    ...stats,
  };
};

type Modules = Awaited<ReturnType<typeof loadModules>>;

const EVENT_ID = crypto.randomUUID();
const STUDENT_ID = crypto.randomUUID();
const FIELD_DIET_ID = crypto.randomUUID();
const FIELD_ALLERGY_ID = crypto.randomUUID();
const ANNA_ID = crypto.randomUUID();
const BELA_ID = crypto.randomUUID();
const STUDENT_REGISTRATION_ID = crypto.randomUUID();
// Unique per run: the dev database is shared, and a fixed address left behind
// by a crashed run would block the next one on the email unique constraint.
const STUDENT_EMAIL = `kiss.anna.${STUDENT_ID.slice(0, 8)}@example.hu`;
const ANNA_EMAIL = `anna.${ANNA_ID.slice(0, 8)}@example.hu`;
const BELA_EMAIL = `bela.${BELA_ID.slice(0, 8)}@example.hu`;

/** A fixed day, so the per-day timeline is deterministic. */
const at = (hour: number) => new Date(2026, 4, 5, hour, 0, 0);

describe.skipIf(!hasDatabase)('event participant reads', () => {
  let modules: Modules;

  const seed = async () => {
    const { db } = modules;
    await db.insert(modules.event).values({
      capacity: 5,
      category: 'open_day',
      description: [],
      endsAt: at(17),
      id: EVENT_ID,
      startsAt: at(9),
      status: 'published',
      title: 'Nyílt nap',
    });

    await db.insert(modules.user).values({
      createdAt: at(8),
      email: STUDENT_EMAIL,
      emailVerified: true,
      id: STUDENT_ID,
      name: 'Kiss Anna',
      updatedAt: at(8),
    });

    await db.insert(modules.eventField).values([
      {
        audiences: ['guest', 'student'],
        eventId: EVENT_ID,
        id: FIELD_DIET_ID,
        label: 'Étel',
        options: ['vegan', 'húsos'],
        position: 0,
        type: 'select',
      },
      {
        audiences: ['guest', 'student'],
        eventId: EVENT_ID,
        id: FIELD_ALLERGY_ID,
        label: 'Allergia',
        position: 1,
        type: 'text',
      },
    ]);

    await db.insert(modules.eventRegistration).values([
      {
        createdAt: at(9),
        eventId: EVENT_ID,
        guestEmail: BELA_EMAIL,
        guestName: 'Nagy Béla',
        id: BELA_ID,
        role: 'visitor',
        status: 'cancelled',
      },
      {
        createdAt: at(10),
        eventId: EVENT_ID,
        guestEmail: ANNA_EMAIL,
        guestName: 'Kiss Anna',
        id: ANNA_ID,
        role: 'visitor',
        status: 'confirmed',
      },
      {
        createdAt: at(11),
        eventId: EVENT_ID,
        id: STUDENT_REGISTRATION_ID,
        role: 'participant',
        status: 'confirmed',
        userId: STUDENT_ID,
      },
    ]);

    await db.insert(modules.eventRegistrationAnswer).values([
      { fieldId: FIELD_DIET_ID, registrationId: ANNA_ID, value: 'vegan' },
      { fieldId: FIELD_ALLERGY_ID, registrationId: ANNA_ID, value: 'mogyoró' },
      { fieldId: FIELD_DIET_ID, registrationId: BELA_ID, value: 'húsos' },
      {
        fieldId: FIELD_DIET_ID,
        registrationId: STUDENT_REGISTRATION_ID,
        value: 'vegan',
      },
    ]);

    await db.insert(modules.eventTicket).values([
      { checkedInAt: at(12), registrationId: ANNA_ID },
      // A cancelled visitor who was already stamped: the ticket keeps the
      // check-in, but the stats must stop counting them once the seat is free.
      { checkedInAt: at(13), registrationId: BELA_ID },
    ]);
  };

  beforeAll(async () => {
    modules = await loadModules();
    await seed();
  });

  afterAll(async () => {
    // Deleting this event cascades its questions, registrations, answers and
    // tickets; the student user is the only row that has to go by hand. Both
    // deletes are scoped to the seeded ids — an unscoped one would empty the
    // shared development database.
    await modules.db
      .delete(modules.event)
      .where(eq(modules.event.id, EVENT_ID));
    await modules.db
      .delete(modules.user)
      .where(eq(modules.user.id, STUDENT_ID));
  });

  const list = (overrides: Record<string, unknown> = {}) =>
    modules.listEventRegistrations({
      id: EVENT_ID,
      limit: 20,
      offset: 0,
      ...overrides,
    } as Parameters<Modules['listEventRegistrations']>[0]);

  it('pages every registration newest first, with its answers', async () => {
    const { items, total } = await list();

    expect(total).toBe(3);
    expect(items.map((item) => item.id)).toEqual([
      STUDENT_REGISTRATION_ID,
      ANNA_ID,
      BELA_ID,
    ]);

    const anna = items.find((item) => item.id === ANNA_ID);
    expect(anna?.name).toBe('Kiss Anna');
    expect(anna?.email).toBe(ANNA_EMAIL);
    expect(anna?.checkedInAt).toEqual(at(12));
    expect(anna?.answers).toEqual([
      { fieldId: FIELD_DIET_ID, label: 'Étel', type: 'select', value: 'vegan' },
      {
        fieldId: FIELD_ALLERGY_ID,
        label: 'Allergia',
        type: 'text',
        value: 'mogyoró',
      },
    ]);
  });

  it('filters by role and by status', async () => {
    expect((await list({ role: 'visitor' })).total).toBe(2);
    expect((await list({ role: 'participant' })).total).toBe(1);
    expect((await list({ status: 'cancelled' })).total).toBe(1);
    expect((await list({ status: 'confirmed' })).total).toBe(2);
    expect((await list({ role: 'visitor', status: 'confirmed' })).total).toBe(
      1
    );
  });

  it('searches the name and the email of both a guest and a student', async () => {
    expect((await list({ search: 'béla' })).total).toBe(1);
    expect((await list({ search: 'NAGY BÉLA' })).total).toBe(1);
    expect((await list({ search: ANNA_EMAIL })).total).toBe(1);
    expect((await list({ search: STUDENT_EMAIL.toUpperCase() })).total).toBe(1);
    expect((await list({ search: 'nobody' })).total).toBe(0);
  });

  it('counts the unpaged total while returning one page', async () => {
    const page = await list({ limit: 1, offset: 1 });
    expect(page.total).toBe(3);
    expect(page.items.map((item) => item.id)).toEqual([ANNA_ID]);
  });

  it('answers the stats numbers of the seeded rows', async () => {
    const stats = await modules.readEventStats(EVENT_ID);

    expect(stats.seats).toEqual({ capacity: 5, remaining: 3, taken: 2 });
    expect(stats.byRole).toEqual({ helper: 0, participant: 1, visitor: 2 });
    expect(stats.byStatus).toEqual({
      cancelled: 1,
      confirmed: 2,
      pending: 0,
    });
    // Two tickets are stamped, but the cancelled visitor's no longer counts:
    // the check-in total has to agree with the seat the cancel gave back.
    expect(stats.checkedIn).toBe(1);
    expect(stats.confirmedHelpers).toBe(0);
    expect(stats.perDay).toEqual([{ count: 3, date: '2026-05-05' }]);
    expect(stats.answers).toEqual([
      {
        answered: 2,
        fieldId: FIELD_DIET_ID,
        label: 'Étel',
        options: [
          { count: 2, value: 'vegan' },
          { count: 0, value: 'húsos' },
        ],
        type: 'select',
      },
      {
        answered: 1,
        fieldId: FIELD_ALLERGY_ID,
        label: 'Allergia',
        options: null,
        type: 'text',
      },
    ]);
  });
});
