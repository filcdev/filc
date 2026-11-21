import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';
import { eq, inArray } from 'drizzle-orm';

/**
 * The decision and seat rules want a real Postgres, so the suite skips when the
 * app has no database configured, exactly like the participant read tests.
 */
const hasDatabase = Boolean(process.env.CHRONOS_DATABASE_URL);

const loadModules = async () => {
  const [database, authentication, schema, decision, seats] = await Promise.all(
    [
      import('#database'),
      import('#database/schema/authentication'),
      import('#modules/events/schema'),
      import('#modules/events/utils/decision'),
      import('#modules/events/utils/seats'),
    ]
  );
  return {
    ...database,
    ...authentication,
    ...schema,
    ...decision,
    ...seats,
  };
};

type Modules = Awaited<ReturnType<typeof loadModules>>;

const EVENT_ID = crypto.randomUUID();
const PENDING_STUDENT = crypto.randomUUID();
const DECLINE_STUDENT = crypto.randomUUID();
const CONFIRMED_STUDENT = crypto.randomUUID();
const PENDING_ID = crypto.randomUUID();
const DECLINE_ID = crypto.randomUUID();
const CONFIRMED_ID = crypto.randomUUID();
const STUDENT_IDS = [PENDING_STUDENT, DECLINE_STUDENT, CONFIRMED_STUDENT];
const EMAIL_PREFIX = EVENT_ID.slice(0, 8);

const at = (hour: number) => new Date(2026, 4, 5, hour, 0, 0);

describe.skipIf(!hasDatabase)('helper registration decision', () => {
  let modules: Modules;

  const decide = (registrationId: string, decision: 'approve' | 'decline') =>
    modules.db.transaction((tx) =>
      modules.decidePendingRegistration(tx, {
        decision,
        id: EVENT_ID,
        registrationId,
      })
    );

  beforeAll(async () => {
    modules = await loadModules();
    const { db } = modules;

    await db.insert(modules.event).values({
      capacity: 1,
      category: 'open_day',
      description: [],
      endsAt: at(17),
      helperRegistrationEnabled: true,
      id: EVENT_ID,
      startsAt: at(9),
      status: 'published',
      title: 'Nyílt nap',
    });

    await db.insert(modules.user).values(
      STUDENT_IDS.map((id, index) => ({
        createdAt: at(8),
        email: `helper.${index}.${EMAIL_PREFIX}@example.hu`,
        emailVerified: true,
        id,
        name: `Helper ${index}`,
        updatedAt: at(8),
      }))
    );

    // One pending row to approve, one to decline, one already confirmed: three
    // students, because the event holds at most one row per student.
    await db.insert(modules.eventRegistration).values([
      {
        eventId: EVENT_ID,
        id: PENDING_ID,
        role: 'helper',
        status: 'pending',
        userId: PENDING_STUDENT,
      },
      {
        eventId: EVENT_ID,
        id: DECLINE_ID,
        role: 'helper',
        status: 'pending',
        userId: DECLINE_STUDENT,
      },
      {
        eventId: EVENT_ID,
        id: CONFIRMED_ID,
        role: 'helper',
        status: 'confirmed',
        userId: CONFIRMED_STUDENT,
      },
    ]);
  });

  afterAll(async () => {
    await modules.db
      .delete(modules.event)
      .where(eq(modules.event.id, EVENT_ID));
    await modules.db
      .delete(modules.user)
      .where(inArray(modules.user.id, STUDENT_IDS));
  });

  it('does not count a pending helper as a seat', async () => {
    expect(await modules.seatCount(EVENT_ID)).toBe(0);
  });

  it('approves a pending helper into confirmed, still without a seat', async () => {
    const registration = await decide(PENDING_ID, 'approve');

    expect(registration.status).toBe('confirmed');
    expect(registration.role).toBe('helper');
    expect(registration.answers).toEqual([]);
    // Confirmed or not, a helper never occupies a seat.
    expect(await modules.seatCount(EVENT_ID)).toBe(0);
  });

  it('declines a pending helper into cancelled', async () => {
    const registration = await decide(DECLINE_ID, 'decline');

    expect(registration.status).toBe('cancelled');
    expect(await modules.seatCount(EVENT_ID)).toBe(0);
  });

  it('answers 409 when the row is no longer pending', async () => {
    let status: number | undefined;
    try {
      await decide(CONFIRMED_ID, 'approve');
    } catch (error) {
      status = (error as { status?: number }).status;
    }
    expect(status).toBe(409);
  });

  it('holds one row per student per event', async () => {
    let violated = false;
    try {
      await modules.db.insert(modules.eventRegistration).values({
        eventId: EVENT_ID,
        role: 'participant',
        status: 'confirmed',
        userId: PENDING_STUDENT,
      });
    } catch {
      violated = true;
    }
    expect(violated).toBe(true);
  });
});
