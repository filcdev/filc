import { describe, expect, it } from 'bun:test';
import {
  type CheckinStore,
  type CheckinTicket,
  checkInTicket,
} from '#modules/events/utils/checkin';

const EVENT_ID = '5b4d1f1e-9c3a-4a2e-8b1f-0d2c3b4a5f60';
const OTHER_EVENT_ID = '0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b';
const TICKET_ID = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
const REGISTRATION_ID = '1a2b3c4d-5e6f-4a7b-9c8d-7e6f5a4b3c2d';
const HELPER_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';

const FIRST_SCAN = new Date('2026-11-18T08:00:00.000Z');
const LATER_SCAN = new Date('2026-11-18T08:00:05.000Z');

const ticket = (overrides: Partial<CheckinTicket> = {}): CheckinTicket => ({
  answers: [],
  checkedInAt: null,
  checkedInByName: null,
  eventId: EVENT_ID,
  registrationId: REGISTRATION_ID,
  registrationStatus: 'confirmed',
  ticketId: TICKET_ID,
  visitorEmail: 'visitor@example.com',
  visitorName: 'Guest Visitor',
  ...overrides,
});

const visitor = {
  answers: [],
  registrationId: REGISTRATION_ID,
  visitorEmail: 'visitor@example.com',
  visitorName: 'Guest Visitor',
};

/** An in-memory door: the smallest store the operation needs, and a writable row. */
const memoryStore = (rows: CheckinTicket[]) => {
  const byId = new Map(rows.map((row) => [row.ticketId, { ...row }]));
  return {
    byId,
    findTicket: (code: string) => Promise.resolve(byId.get(code) ?? null),
    markCheckedIn: (ticketId: string, _userId: string, at: Date) => {
      const row = byId.get(ticketId);
      if (!row || row.checkedInAt) {
        return Promise.resolve(false);
      }
      byId.set(ticketId, {
        ...row,
        checkedInAt: at,
        checkedInByName: 'Helper',
      });
      return Promise.resolve(true);
    },
  };
};

/**
 * The door's state machine. Each case is one scan the scanner app renders, and
 * the repeat case is the idempotency the door depends on: a helper who scans
 * twice must see the first time and colleague, not a second admission.
 */
describe('checkInTicket', () => {
  it('admits the first scan, then reports the stored check-in', async () => {
    const store = memoryStore([ticket()]);

    const first = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });
    expect(first).toEqual({ ...visitor, status: 'admitted' });

    const second = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [],
      now: LATER_SCAN,
      userId: HELPER_ID,
    });
    expect(second).toEqual({
      ...visitor,
      checkedInAt: FIRST_SCAN,
      checkedInByName: 'Helper',
      status: 'already_checked_in',
    });

    // The repeat scan did not move the time or the helper.
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(FIRST_SCAN);
    expect(store.byId.get(TICKET_ID)?.checkedInByName).toBe('Helper');
  });

  it('does not confirm a ticket of another event', async () => {
    const store = memoryStore([ticket({ eventId: OTHER_EVENT_ID })]);

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({ status: 'not_found' });
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(null);
  });

  it('refuses a cancelled registration without writing a check-in', async () => {
    const store = memoryStore([ticket({ registrationStatus: 'cancelled' })]);

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({ ...visitor, status: 'invalid' });
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(null);
  });

  it('answers an unknown code as not found', async () => {
    const store = memoryStore([ticket()]);

    const result = await checkInTicket(store, {
      code: '6f5e4d3c-2b1a-4098-8776-5a4b3c2d1e0f',
      display: 'full',
      eventId: EVENT_ID,
      fields: [],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({ status: 'not_found' });
  });

  it('admits a confirmed student ticket and refuses it once cancelled', async () => {
    // Students and helpers carry a ticket now, not only guests: the door's
    // cancellation rule is what still keeps a withdrawn place out.
    const student = () =>
      ticket({
        registrationStatus: 'confirmed',
        visitorEmail: 'student@example.com',
        visitorName: 'Jegyes Diák',
      });

    const admitted = await checkInTicket(memoryStore([student()]), {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });
    expect(admitted).toMatchObject({ status: 'admitted' });

    const cancelled = memoryStore([
      { ...student(), registrationStatus: 'cancelled' },
    ]);
    const refused = await checkInTicket(cancelled, {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });
    expect(refused).toMatchObject({ status: 'invalid' });
    expect(cancelled.byId.get(TICKET_ID)?.checkedInAt).toBe(null);
  });

  it('answers the stored check-in when another scan wins the write', async () => {
    let reads = 0;
    // The read before the update sees an unchecked ticket; the update loses,
    // and the read after it sees the colleague's check-in.
    const store: CheckinStore = {
      findTicket: () => {
        reads += 1;
        return Promise.resolve(
          reads === 1
            ? ticket()
            : ticket({
                checkedInAt: FIRST_SCAN,
                checkedInByName: 'Other Helper',
              })
        );
      },
      markCheckedIn: () => Promise.resolve(false),
    };

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [],
      now: LATER_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({
      ...visitor,
      checkedInAt: FIRST_SCAN,
      checkedInByName: 'Other Helper',
      status: 'already_checked_in',
    });
  });
});

/**
 * The event's check-in display is a privacy setting, so the payload is shaped
 * where it is built. A hidden field is left out of the object entirely; the
 * assertions check for absence, not a null or empty placeholder.
 */
describe('checkInTicket display modes', () => {
  const scanAs = (display: 'minimal' | 'name' | 'full') =>
    checkInTicket(memoryStore([ticket()]), {
      code: TICKET_ID,
      display,
      eventId: EVENT_ID,
      fields: [],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

  it('answers minimal with the registration id only', async () => {
    const result = await scanAs('minimal');

    expect(result).toEqual({
      answers: [],
      registrationId: REGISTRATION_ID,
      status: 'admitted',
    });
    expect(result).not.toHaveProperty('visitorName');
    expect(result).not.toHaveProperty('visitorEmail');
  });

  it('answers name with the name and no email', async () => {
    const result = await scanAs('name');

    expect(result).toEqual({
      answers: [],
      registrationId: REGISTRATION_ID,
      status: 'admitted',
      visitorName: 'Guest Visitor',
    });
    expect(result).not.toHaveProperty('visitorEmail');
  });

  it('answers full with both', async () => {
    const result = await scanAs('full');

    expect(result).toEqual({ ...visitor, status: 'admitted' });
  });

  it('applies the mode to an already checked-in answer', async () => {
    const store = memoryStore([
      ticket({ checkedInAt: FIRST_SCAN, checkedInByName: 'Helper' }),
    ]);

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'minimal',
      eventId: EVENT_ID,
      fields: [],
      now: LATER_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({
      answers: [],
      checkedInAt: FIRST_SCAN,
      checkedInByName: 'Helper',
      registrationId: REGISTRATION_ID,
      status: 'already_checked_in',
    });
    expect(result).not.toHaveProperty('visitorName');
    expect(result).not.toHaveProperty('visitorEmail');
  });

  it('applies the mode to a cancelled ticket too', async () => {
    const store = memoryStore([ticket({ registrationStatus: 'cancelled' })]);

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'minimal',
      eventId: EVENT_ID,
      fields: [],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({
      answers: [],
      registrationId: REGISTRATION_ID,
      status: 'invalid',
    });
    expect(result).not.toHaveProperty('visitorName');
    expect(result).not.toHaveProperty('visitorEmail');
  });
});

/**
 * The answers are a second, independent setting: the event names the question
 * ids, and a scan returns exactly those answers. Identity and answers combine
 * freely, so `minimal` is the privacy-safe configuration rather than the
 * answer-less one.
 */
describe('checkInTicket answers', () => {
  const NAME_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
  const CLASS_ID = '4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a';
  const DIET_ID = '6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b9c';

  const answer = (fieldId: string, label: string, value: string) => ({
    fieldId,
    label,
    value,
  });

  it('returns only the configured questions, in the configured order', async () => {
    const store = memoryStore([
      ticket({
        answers: [
          answer(NAME_ID, 'Név', 'Anna'),
          answer(CLASS_ID, 'Osztály', '10.B'),
          answer(DIET_ID, 'Étrend', 'vegán'),
        ],
      }),
    ]);

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [CLASS_ID, NAME_ID],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({
      ...visitor,
      answers: [
        answer(CLASS_ID, 'Osztály', '10.B'),
        answer(NAME_ID, 'Név', 'Anna'),
      ],
      status: 'admitted',
    });
    // The unconfigured answer is not in the payload at all.
    expect(JSON.stringify(result)).not.toContain('vegán');
  });

  it('shows answers without identity in minimal mode', async () => {
    const store = memoryStore([
      ticket({ answers: [answer(CLASS_ID, 'Osztály', '10.B')] }),
    ]);

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'minimal',
      eventId: EVENT_ID,
      fields: [CLASS_ID],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({
      answers: [answer(CLASS_ID, 'Osztály', '10.B')],
      registrationId: REGISTRATION_ID,
      status: 'admitted',
    });
    expect(result).not.toHaveProperty('visitorName');
    expect(result).not.toHaveProperty('visitorEmail');
  });

  it('omits a configured question the registration did not answer', async () => {
    const store = memoryStore([
      ticket({ answers: [answer(CLASS_ID, 'Osztály', '10.B')] }),
    ]);

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [CLASS_ID, DIET_ID],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({
      ...visitor,
      answers: [answer(CLASS_ID, 'Osztály', '10.B')],
      status: 'admitted',
    });
  });

  it('returns an empty list for an answer-less registration', async () => {
    const result = await checkInTicket(memoryStore([ticket()]), {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [CLASS_ID],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toMatchObject({ answers: [] });
  });

  it('filters the answers of a cancelled ticket the same way', async () => {
    const store = memoryStore([
      ticket({
        answers: [
          answer(CLASS_ID, 'Osztály', '10.B'),
          answer(DIET_ID, 'Étrend', 'vegán'),
        ],
        registrationStatus: 'cancelled',
      }),
    ]);

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      display: 'full',
      eventId: EVENT_ID,
      fields: [DIET_ID],
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({
      ...visitor,
      answers: [answer(DIET_ID, 'Étrend', 'vegán')],
      status: 'invalid',
    });
  });
});
