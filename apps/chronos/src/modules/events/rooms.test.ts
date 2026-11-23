import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import process from 'node:process';
import { eventRoomWriteSchema } from '@filcdev/api/domains/events/room';
import { eq, inArray } from 'drizzle-orm';
import type { ChronosContext } from '#_types/globals';

/**
 * Rooms over the real handlers: the organizer's room CRUD, the registration
 * rules (a roomed event needs a room, the room must belong to the event, the
 * last room seat is race-safe) and the detail read the public page polls.
 *
 * The database tests skip when the app has no database configured, and the
 * modules are imported lazily because `#database` parses the env at import time.
 */
const hasDatabase = Boolean(process.env.CHRONOS_DATABASE_URL);

const ORGANIZER_ID = crypto.randomUUID();
const STUDENT_A = crypto.randomUUID();
const STUDENT_B = crypto.randomUUID();
const USER_IDS = [ORGANIZER_ID, STUDENT_A, STUDENT_B];

const loadModules = async () => {
  const [
    database,
    authentication,
    schema,
    rooms,
    registrations,
    guests,
    events,
    eventExport,
    activityLog,
    authorization,
  ] = await Promise.all([
    import('#database'),
    import('#database/schema/authentication'),
    import('#modules/events/schema'),
    import('#modules/events/rooms'),
    import('#modules/events/registrations'),
    import('#modules/events/guests'),
    import('#modules/events/events'),
    import('#modules/events/export'),
    import('#modules/activity-log/schema'),
    import('#utils/authorization'),
  ]);
  return {
    ...activityLog,
    ...authentication,
    ...authorization,
    ...database,
    ...events,
    ...eventExport,
    ...guests,
    ...registrations,
    ...rooms,
    ...schema,
  };
};

type Modules = Awaited<ReturnType<typeof loadModules>>;

const contextFor = (userId: string | null): ChronosContext =>
  ({
    anonymousId: userId ? null : crypto.randomUUID(),
    clientIp: '127.0.0.1',
    reqHeaders: new Headers(),
    requestId: crypto.randomUUID(),
    resHeaders: new Headers(),
    session: userId
      ? { id: crypto.randomUUID(), userId }
      : (null as unknown as ChronosContext['session']),
    user: userId ? { id: userId } : (null as unknown as ChronosContext['user']),
  }) as unknown as ChronosContext;

describe('room input schema', () => {
  it('requires a non-empty name and a positive capacity', () => {
    expect(
      eventRoomWriteSchema.safeParse({ capacity: 0, name: 'A' }).success
    ).toBe(false);
    expect(
      eventRoomWriteSchema.safeParse({ capacity: 1, name: '   ' }).success
    ).toBe(false);
    expect(
      eventRoomWriteSchema.safeParse({ capacity: 20, name: '12-es terem' })
        .success
    ).toBe(true);
  });
});

describe.skipIf(!hasDatabase)('event rooms', () => {
  let modules: Modules;
  const eventIds: string[] = [];

  const createEventRow = async (
    overrides: {
      capacity?: number | null;
      guestRegistrationEnabled?: boolean;
      title?: string;
    } = {}
  ) => {
    const [row] = await modules.db
      .insert(modules.event)
      .values({
        capacity: overrides.capacity ?? 10,
        category: 'open_day',
        description: [],
        endsAt: new Date('2026-09-01T17:00:00'),
        guestRegistrationEnabled: overrides.guestRegistrationEnabled ?? false,
        registrationEnabled: true,
        startsAt: new Date('2026-09-01T09:00:00'),
        status: 'published',
        title: overrides.title ?? 'Pályaorientációs nap',
      })
      .returning();
    if (!row) {
      throw new Error('Failed to insert the test event');
    }
    eventIds.push(row.id);
    return row;
  };

  const createRoom = (eventId: string, name: string, capacity: number) =>
    modules.createEventRoom.callable({ context: contextFor(ORGANIZER_ID) })({
      capacity,
      id: eventId,
      name,
    });

  const register = (userId: string, eventId: string, roomId?: string) =>
    modules.createRegistration.callable({ context: contextFor(userId) })({
      id: eventId,
      role: 'participant',
      ...(roomId ? { roomId } : {}),
    });

  beforeAll(async () => {
    modules = await loadModules();
    await modules.initializeRBAC();

    await modules.db.insert(modules.user).values(
      USER_IDS.map((id, index) => ({
        createdAt: new Date(),
        email: `rooms.${index}.${id.slice(0, 8)}@example.hu`,
        emailVerified: true,
        id,
        name: `Rooms test ${index}`,
        roles: index === 0 ? ['admin'] : ['user'],
        updatedAt: new Date(),
      }))
    );
  });

  afterAll(async () => {
    if (!modules) {
      return;
    }
    if (eventIds.length > 0) {
      await modules.db
        .delete(modules.activityLog)
        .where(inArray(modules.activityLog.entityId, eventIds));
      await modules.db
        .delete(modules.event)
        .where(inArray(modules.event.id, eventIds));
    }
    await modules.db
      .delete(modules.user)
      .where(inArray(modules.user.id, USER_IDS));
  });

  it('lets only an organizer create, update and delete a room', async () => {
    const event = await createEventRow();

    await expect(
      modules.createEventRoom.callable({ context: contextFor(STUDENT_A) })({
        capacity: 2,
        id: event.id,
        name: 'Terem',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const created = await createRoom(event.id, '12-es terem', 2);
    expect(created).toMatchObject({ capacity: 2, eventId: event.id });

    const updated = await modules.updateEventRoom.callable({
      context: contextFor(ORGANIZER_ID),
    })({
      capacity: 3,
      id: event.id,
      name: '13-as terem',
      roomId: created.id,
    });
    expect(updated).toMatchObject({ capacity: 3, name: '13-as terem' });

    // A room of another event is a 404, never an edit across events.
    const other = await createEventRow();
    await expect(
      modules.updateEventRoom.callable({ context: contextFor(ORGANIZER_ID) })({
        capacity: 1,
        id: other.id,
        name: 'Idegen',
        roomId: created.id,
      })
    ).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });

    expect(
      await modules.deleteEventRoom.callable({
        context: contextFor(ORGANIZER_ID),
      })({ id: event.id, roomId: created.id })
    ).toEqual({ id: created.id });
    expect(
      await modules.db
        .select()
        .from(modules.eventRoom)
        .where(eq(modules.eventRoom.id, created.id))
    ).toHaveLength(0);
  });

  it('refuses to delete a room a registration still names', async () => {
    const event = await createEventRow();
    const room = await createRoom(event.id, 'Egyetlen terem', 5);
    await register(STUDENT_A, event.id, room.id);

    await expect(
      modules.deleteEventRoom.callable({ context: contextFor(ORGANIZER_ID) })({
        id: event.id,
        roomId: room.id,
      })
    ).rejects.toMatchObject({ code: 'ROOM_HAS_REGISTRATIONS' });

    // The room is still there and the registration still names it.
    const [kept] = await modules.db
      .select()
      .from(modules.eventRoom)
      .where(eq(modules.eventRoom.id, room.id));
    expect(kept?.id).toBe(room.id);
  });

  it('requires a room on a roomed event and rejects another event’s room', async () => {
    const event = await createEventRow();
    const room = await createRoom(event.id, 'Első terem', 2);
    const other = await createEventRow();
    const otherRoom = await createRoom(other.id, 'Másik terem', 2);

    await expect(register(STUDENT_A, event.id)).rejects.toMatchObject({
      code: 'ROOM_REQUIRED',
    });
    await expect(
      register(STUDENT_A, event.id, otherRoom.id)
    ).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });

    const registration = await register(STUDENT_A, event.id, room.id);
    expect(registration.room).toEqual({ id: room.id, name: 'Első terem' });
  });

  it('reports per-room remaining places on the detail read, shrinking live', async () => {
    const event = await createEventRow();
    const room = await createRoom(event.id, 'Élő terem', 3);

    const before = await modules.getEvent.callable({
      context: contextFor(STUDENT_A),
    })({ id: event.id, includeDrafts: 'true' });
    expect(before.rooms).toEqual([
      { capacity: 3, id: room.id, name: 'Élő terem', remaining: 3 },
    ]);

    await register(STUDENT_A, event.id, room.id);

    // The same payload the ten-second poll reads carries the fresher count.
    const after = await modules.getEvent.callable({
      context: contextFor(STUDENT_A),
    })({ id: event.id, includeDrafts: 'true' });
    expect(after.rooms[0]?.remaining).toBe(2);
  });

  it('lets exactly one of two racing signups take the last room seat', async () => {
    const event = await createEventRow({ capacity: 10 });
    const room = await createRoom(event.id, 'Utolsó hely', 1);

    const results = await Promise.allSettled([
      register(STUDENT_A, event.id, room.id),
      register(STUDENT_B, event.id, room.id),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: 'ROOM_FULL' });

    const confirmed = await modules.db
      .select()
      .from(modules.eventRegistration)
      .where(eq(modules.eventRegistration.roomId, room.id));
    expect(confirmed.filter((row) => row.status === 'confirmed')).toHaveLength(
      1
    );
  });

  it('still enforces the event capacity when the room has room left', async () => {
    const event = await createEventRow({ capacity: 1 });
    const roomA = await createRoom(event.id, 'A terem', 5);
    const roomB = await createRoom(event.id, 'B terem', 5);

    await register(STUDENT_A, event.id, roomA.id);
    // The event is full even though room B has five free places.
    await expect(register(STUDENT_B, event.id, roomB.id)).rejects.toMatchObject(
      { code: 'CONFLICT' }
    );
  });

  it('puts the room name in the export', async () => {
    const event = await createEventRow();
    const room = await createRoom(event.id, 'Export terem', 5);
    await register(STUDENT_A, event.id, room.id);

    const file = await modules.exportEventRegistrations.callable({
      context: contextFor(ORGANIZER_ID),
    })({ id: event.id });
    const csv = await file.text();

    expect(csv.split('\n')[0]).toContain('room');
    expect(csv).toContain('Export terem');
  });

  it('asks a guest for a room too, and takes its seat', async () => {
    const event = await createEventRow({ guestRegistrationEnabled: true });
    const room = await createRoom(event.id, 'Vendég terem', 2);

    const guest = (roomId?: string) =>
      modules.createGuestRegistration.callable({
        context: contextFor(null),
      })({
        email: `guest.${crypto.randomUUID().slice(0, 8)}@example.hu`,
        id: event.id,
        name: 'Vendég Szülő',
        ...(roomId ? { roomId } : {}),
      });

    await expect(guest()).rejects.toMatchObject({ code: 'ROOM_REQUIRED' });
    await expect(guest(crypto.randomUUID())).rejects.toMatchObject({
      code: 'ROOM_NOT_FOUND',
    });
    await guest(room.id);

    const after = await modules.getEvent.callable({
      context: contextFor(STUDENT_A),
    })({ id: event.id, includeDrafts: 'true' });
    expect(after.rooms[0]?.remaining).toBe(1);
  });
});
