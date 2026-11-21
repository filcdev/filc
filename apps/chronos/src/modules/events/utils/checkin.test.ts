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
      eventId: EVENT_ID,
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });
    expect(first).toEqual({ ...visitor, status: 'admitted' });

    const second = await checkInTicket(store, {
      code: TICKET_ID,
      eventId: EVENT_ID,
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
      eventId: EVENT_ID,
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
      eventId: EVENT_ID,
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
      eventId: EVENT_ID,
      now: FIRST_SCAN,
      userId: HELPER_ID,
    });

    expect(result).toEqual({ status: 'not_found' });
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
      eventId: EVENT_ID,
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
