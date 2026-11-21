import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';
import { and, eq, inArray } from 'drizzle-orm';

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
const FIELD_ID = crypto.randomUUID();
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

    await db.insert(modules.eventField).values({
      audiences: ['student'],
      eventId: EVENT_ID,
      id: FIELD_ID,
      label: 'Szakirány',
      options: null,
      position: 0,
      required: true,
      type: 'text',
    });

    await db.insert(modules.eventRegistrationAnswer).values({
      fieldId: FIELD_ID,
      registrationId: PENDING_ID,
      value: 'informatika',
    });
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
    expect(registration.answers).toEqual([
      { fieldId: FIELD_ID, value: 'informatika' },
    ]);
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

describe.skipIf(!hasDatabase)('helper capacity at the decision', () => {
  let modules: Modules;

  const CAP_EVENT_ID = crypto.randomUUID();
  const CONFIRMED_A = crypto.randomUUID();
  const CONFIRMED_B = crypto.randomUUID();
  const WAITING = crypto.randomUUID();
  const CAP_USERS = [CONFIRMED_A, CONFIRMED_B, WAITING];
  const WAITING_ID = crypto.randomUUID();
  const CAP_PREFIX = CAP_EVENT_ID.slice(0, 8);

  const decide = (registrationId: string, decision: 'approve' | 'decline') =>
    modules.db.transaction((tx) =>
      modules.decidePendingRegistration(tx, {
        decision,
        id: CAP_EVENT_ID,
        registrationId,
      })
    );

  const setCapacity = (helperCapacity: number) =>
    modules.db
      .update(modules.event)
      .set({ helperCapacity })
      .where(eq(modules.event.id, CAP_EVENT_ID));

  const confirmedCount = async () => {
    const rows = await modules.db
      .select({ id: modules.eventRegistration.id })
      .from(modules.eventRegistration)
      .where(
        and(
          eq(modules.eventRegistration.eventId, CAP_EVENT_ID),
          eq(modules.eventRegistration.role, 'helper'),
          eq(modules.eventRegistration.status, 'confirmed')
        )
      );
    return rows.length;
  };

  beforeAll(async () => {
    modules = await loadModules();

    await modules.db.insert(modules.event).values({
      category: 'open_day',
      description: [],
      endsAt: at(17),
      helperCapacity: 2,
      helperRegistrationEnabled: true,
      id: CAP_EVENT_ID,
      startsAt: at(9),
      status: 'published',
      title: 'Segítői létszám',
    });

    await modules.db.insert(modules.user).values(
      CAP_USERS.map((id, index) => ({
        createdAt: at(8),
        email: `capacity.${index}.${CAP_PREFIX}@example.hu`,
        emailVerified: true,
        id,
        name: `Signup ${index}`,
        updatedAt: at(8),
      }))
    );

    await modules.db.insert(modules.eventRegistration).values([
      {
        eventId: CAP_EVENT_ID,
        role: 'helper',
        status: 'confirmed',
        userId: CONFIRMED_A,
      },
      {
        eventId: CAP_EVENT_ID,
        role: 'helper',
        status: 'confirmed',
        userId: CONFIRMED_B,
      },
      {
        eventId: CAP_EVENT_ID,
        id: WAITING_ID,
        role: 'helper',
        status: 'pending',
        userId: WAITING,
      },
    ]);
  });

  afterAll(async () => {
    if (!modules) {
      return;
    }
    // The event cascade takes its registrations and check-in grants with it.
    await modules.db
      .delete(modules.event)
      .where(eq(modules.event.id, CAP_EVENT_ID));
    await modules.db
      .delete(modules.user)
      .where(inArray(modules.user.id, CAP_USERS));
  });

  it('refuses an approval once the confirmed helpers fill the cap', async () => {
    await expect(decide(WAITING_ID, 'approve')).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    const [row] = await modules.db
      .select({ status: modules.eventRegistration.status })
      .from(modules.eventRegistration)
      .where(eq(modules.eventRegistration.id, WAITING_ID));
    expect(row?.status).toBe('pending');
  });

  it('keeps every confirmed helper when the cap is lowered below the count', async () => {
    await setCapacity(1);

    expect(await confirmedCount()).toBe(2);
    await expect(decide(WAITING_ID, 'approve')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('approves again once a confirmed helper gives a slot back', async () => {
    await setCapacity(2);
    await modules.db
      .update(modules.eventRegistration)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(modules.eventRegistration.eventId, CAP_EVENT_ID),
          eq(modules.eventRegistration.userId, CONFIRMED_A)
        )
      );

    const registration = await decide(WAITING_ID, 'approve');

    expect(registration.status).toBe('confirmed');
    expect(await confirmedCount()).toBe(2);
  });
});
