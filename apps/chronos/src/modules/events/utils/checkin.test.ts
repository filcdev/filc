import { describe, expect, it } from 'bun:test';
import type {
  EventCheckinRule,
  EventCheckinShow,
} from '@filcdev/api/domains/events/rules';
import {
  type CheckinAnswer,
  type CheckinStore,
  type CheckinTicket,
  checkInTicket,
} from '#modules/events/utils/checkin';
import { pickCheckinConfig } from '#modules/events/utils/checkin-config';

const EVENT_ID = '5b4d1f1e-9c3a-4a2e-8b1f-0d2c3b4a5f60';
const OTHER_EVENT_ID = '0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b';
const TICKET_ID = '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a';
const REGISTRATION_ID = '1a2b3c4d-5e6f-4a7b-9c8d-7e6f5a4b3c2d';
const HELPER_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
const OTHER_HELPER_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b';

const CLASS_ID = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const DIET_ID = '4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a';
const TICKET_KIND_ID = '6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b9c';
const AGE_ID = '8b9c0d1e-2f3a-4b5c-9d6e-7f8a9b0c1d2e';

const ALLOW_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const DENY_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const CATCH_ALL_ID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f';

const FIRST_SCAN = new Date('2026-11-18T08:00:00.000Z');
const LATER_SCAN = new Date('2026-11-18T08:00:05.000Z');

const SHOW_NAME: EventCheckinShow = { email: false, fieldIds: [], name: true };
const SHOW_HIDDEN: EventCheckinShow = {
  email: false,
  fieldIds: [],
  name: false,
};

const answer = (
  fieldId: string,
  label: string,
  value: string,
  type: CheckinAnswer['type'] = 'text'
): CheckinAnswer => ({ fieldId, label, type, value });

const allow = (
  overrides: Partial<EventCheckinRule> = {}
): EventCheckinRule => ({
  action: 'allow',
  id: ALLOW_ID,
  message: '',
  show: SHOW_NAME,
  when: null,
  ...overrides,
});

const deny = (overrides: Partial<EventCheckinRule> = {}): EventCheckinRule => ({
  action: 'deny',
  id: DENY_ID,
  message: 'Nem jogosult',
  show: SHOW_NAME,
  when: { fieldId: CLASS_ID, op: 'equals', value: '10.B' },
  ...overrides,
});

const catchAll = (
  overrides: Partial<EventCheckinRule> = {}
): EventCheckinRule => ({
  action: 'allow',
  id: CATCH_ALL_ID,
  message: '',
  show: SHOW_NAME,
  when: null,
  ...overrides,
});

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

const scan = (
  store: CheckinStore,
  rules: readonly EventCheckinRule[],
  code = TICKET_ID
) =>
  checkInTicket(store, {
    code,
    eventId: EVENT_ID,
    now: FIRST_SCAN,
    rules,
    userId: HELPER_ID,
  });

/**
 * The door's state machine. Each case is one scan the scanner app renders, and
 * the repeat case is the idempotency the door depends on: a helper who scans
 * twice must see the first time and colleague, not a second admission.
 */
describe('checkInTicket', () => {
  it('admits the first scan, then reports the stored check-in', async () => {
    const store = memoryStore([ticket()]);

    const first = await scan(store, [allow()]);
    expect(first).toEqual({
      answers: [],
      details: [],
      registrationId: REGISTRATION_ID,
      status: 'admitted',
      visitorName: 'Guest Visitor',
    });

    const second = await scan(store, [allow()]);
    expect(second).toEqual({
      answers: [],
      checkedInAt: FIRST_SCAN,
      checkedInByName: 'Helper',
      details: [],
      registrationId: REGISTRATION_ID,
      status: 'already_checked_in',
      visitorName: 'Guest Visitor',
    });

    // The repeat scan did not move the time or the helper.
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(FIRST_SCAN);
    expect(store.byId.get(TICKET_ID)?.checkedInByName).toBe('Helper');
  });

  it('does not confirm a ticket of another event', async () => {
    const store = memoryStore([ticket({ eventId: OTHER_EVENT_ID })]);

    expect(await scan(store, [allow()])).toEqual({ status: 'not_found' });
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(null);
  });

  it('answers an unknown code as not found', async () => {
    const store = memoryStore([ticket()]);

    expect(
      await scan(store, [allow()], '6f5e4d3c-2b1a-4098-8776-5a4b3c2d1e0f')
    ).toEqual({ status: 'not_found' });
  });

  it('answers the stored check-in when another scan wins the write', async () => {
    let reads = 0;
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

    const result = await scan(store, [allow()]);
    expect(result).toMatchObject({
      checkedInAt: FIRST_SCAN,
      checkedInByName: 'Other Helper',
      status: 'already_checked_in',
    });
  });
});

/**
 * The rule list is the door's whole configuration: order decides, the catch-all
 * answers everything left over, and a deny is a refusal that writes nothing.
 */
describe('checkin rules', () => {
  it('lets an earlier match win over a later one', async () => {
    const store = memoryStore([
      ticket({ answers: [answer(CLASS_ID, 'Osztály', '10.B')] }),
    ]);

    // The deny rule comes first, so the later allow never runs — even though
    // the registration would satisfy both conditions.
    const rules = [
      deny(),
      allow({
        id: ALLOW_ID,
        show: SHOW_HIDDEN,
        when: { fieldId: CLASS_ID, op: 'equals', value: '10.B' },
      }),
      catchAll(),
    ];

    const result = await scan(store, rules);
    expect(result).toMatchObject({ status: 'not_granted' });
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(null);
  });

  it('denies with the rule message and writes no check-in', async () => {
    const store = memoryStore([
      ticket({ answers: [answer(CLASS_ID, 'Osztály', '10.B')] }),
    ]);

    const result = await scan(store, [deny({ message: 'Nem a 10.B-be jár' })]);
    expect(result).toEqual({
      answers: [],
      details: [
        {
          fieldId: CLASS_ID,
          label: 'Osztály',
          type: 'text',
          value: '10.B',
        },
      ],
      message: 'Nem a 10.B-be jár',
      registrationId: REGISTRATION_ID,
      status: 'not_granted',
      visitorName: 'Guest Visitor',
    });
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(null);
  });

  it('falls through to the catch-all when no condition matches', async () => {
    const store = memoryStore([
      ticket({ answers: [answer(CLASS_ID, 'Osztály', '11.A')] }),
    ]);

    const rules = [deny(), catchAll({ show: SHOW_HIDDEN })];

    const result = await scan(store, rules);
    expect(result).toEqual({
      answers: [],
      details: [
        {
          fieldId: CLASS_ID,
          label: 'Osztály',
          type: 'text',
          value: '11.A',
        },
      ],
      registrationId: REGISTRATION_ID,
      status: 'admitted',
    });
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(FIRST_SCAN);
  });

  it('refuses a cancelled registration before evaluating any rule', async () => {
    const store = memoryStore([
      ticket({
        answers: [answer(CLASS_ID, 'Osztály', '10.B')],
        registrationStatus: 'cancelled',
      }),
    ]);

    // The deny rule would match; the cancellation is answered first instead.
    const result = await scan(store, [deny(), catchAll()]);
    expect(result).toMatchObject({ status: 'invalid' });
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(null);
  });

  it('applies each operator: equals, contains, bounds and ticks', async () => {
    const answers = [
      answer(CLASS_ID, 'Osztály', '  Ábel 10.B '),
      answer(AGE_ID, 'Kor', '16', 'number'),
      answer(TICKET_KIND_ID, 'Napijegy', 'true', 'checkbox'),
    ];
    // A fresh store per assertion: an allow writes a check-in, and the next
    // scan must still be judged, not answered as a repeat.
    const run = (rules: EventCheckinRule[]) =>
      scan(memoryStore([ticket({ answers })]), rules);

    // Accents and case do not matter for text.
    expect(
      await run([
        deny({ when: { fieldId: CLASS_ID, op: 'equals', value: 'abel 10.b' } }),
        catchAll(),
      ])
    ).toMatchObject({ status: 'not_granted' });

    expect(
      await run([
        deny({
          when: { fieldId: CLASS_ID, op: 'contains', value: '10.B' },
        }),
        catchAll(),
      ])
    ).toMatchObject({ status: 'not_granted' });

    expect(
      await run([
        deny({ when: { fieldId: AGE_ID, op: 'gte', value: '18' } }),
        catchAll(),
      ])
    ).toMatchObject({ status: 'admitted' });

    expect(
      await run([
        deny({ when: { fieldId: AGE_ID, op: 'lte', value: '16' } }),
        catchAll(),
      ])
    ).toMatchObject({ status: 'not_granted' });

    expect(
      await run([
        deny({ when: { fieldId: TICKET_KIND_ID, op: 'is_false', value: '' } }),
        catchAll(),
      ])
    ).toMatchObject({ status: 'admitted' });
  });

  it('passes is_false for an unanswered optional checkbox', async () => {
    const store = memoryStore([ticket()]);
    const result = await scan(store, [
      deny({ when: { fieldId: TICKET_KIND_ID, op: 'is_false', value: '' } }),
      catchAll(),
    ]);
    expect(result).toMatchObject({ status: 'not_granted' });
  });
});

/**
 * The matched rule's `show` block is a privacy setting, so the payload is shaped
 * where it is built. A hidden field is left out of the object entirely; the
 * assertions check for absence, not a null or empty placeholder.
 */
describe('checkInTicket show block', () => {
  const answers = [
    answer(CLASS_ID, 'Osztály', '10.B'),
    answer(DIET_ID, 'Étrend', 'vegán', 'textarea'),
    answer(TICKET_KIND_ID, 'Napijegy', 'true', 'checkbox'),
  ];

  it('hides name, email and answers when the rule says so', async () => {
    const store = memoryStore([ticket({ answers })]);
    const result = await scan(store, [allow({ show: SHOW_HIDDEN })]);

    expect(result).toMatchObject({ answers: [], status: 'admitted' });
    expect(result).not.toHaveProperty('visitorName');
    expect(result).not.toHaveProperty('visitorEmail');
  });

  it('shows exactly the answers the rule names, in its order', async () => {
    const store = memoryStore([ticket({ answers })]);
    const result = await scan(store, [
      allow({
        show: { email: false, fieldIds: [DIET_ID, CLASS_ID], name: false },
      }),
    ]);

    expect(result).toMatchObject({
      answers: [
        { fieldId: DIET_ID, label: 'Étrend', value: 'vegán' },
        { fieldId: CLASS_ID, label: 'Osztály', value: '10.B' },
      ],
      status: 'admitted',
    });
    // The unconfigured answer is not in the always-visible list.
    expect(result).not.toHaveProperty('visitorName');
  });

  it('sends the email only when the rule allows it', async () => {
    const store = memoryStore([ticket({ answers })]);
    const result = await scan(store, [
      allow({ show: { email: true, fieldIds: [], name: true } }),
    ]);
    expect(result).toMatchObject({
      visitorEmail: 'visitor@example.com',
      visitorName: 'Guest Visitor',
    });
  });

  it('carries every answer in details, checkboxes as booleans, no email', async () => {
    const store = memoryStore([ticket({ answers })]);
    const result = await scan(store, [allow({ show: SHOW_HIDDEN })]);

    expect(result).toMatchObject({
      details: [
        { fieldId: CLASS_ID, label: 'Osztály', type: 'text', value: '10.B' },
        { fieldId: DIET_ID, label: 'Étrend', type: 'textarea', value: 'vegán' },
        {
          fieldId: TICKET_KIND_ID,
          label: 'Napijegy',
          type: 'checkbox',
          value: true,
        },
      ],
      status: 'admitted',
    });
    expect(JSON.stringify(result)).not.toContain('visitor@example.com');
  });

  it('applies the rule show block to an already checked-in answer', async () => {
    const store = memoryStore([
      ticket({ answers, checkedInAt: FIRST_SCAN, checkedInByName: 'Helper' }),
    ]);

    const result = await checkInTicket(store, {
      code: TICKET_ID,
      eventId: EVENT_ID,
      now: LATER_SCAN,
      rules: [allow({ show: SHOW_HIDDEN })],
      userId: HELPER_ID,
    });

    expect(result).toMatchObject({
      answers: [],
      checkedInAt: FIRST_SCAN,
      checkedInByName: 'Helper',
      status: 'already_checked_in',
    });
    expect(result).not.toHaveProperty('visitorName');
  });

  it('answers a cancelled ticket with no identity and no answers', async () => {
    const store = memoryStore([
      ticket({ answers, registrationStatus: 'cancelled' }),
    ]);

    const result = await scan(store, [
      allow({ show: { email: true, fieldIds: [CLASS_ID], name: true } }),
    ]);

    expect(result).toMatchObject({ answers: [], status: 'invalid' });
    expect(result).not.toHaveProperty('visitorName');
    expect(result).not.toHaveProperty('visitorEmail');
  });
});

/**
 * The door rules are per scanner: the same ticket can be refused for one
 * helper and admitted for the next, because each scan is judged by the config
 * of the person holding the scanner. These cases bind the resolution order to
 * the state machine, which is what the check-in route composes.
 */
describe('per-scanner rules', () => {
  it('lets one helper deny and the next admit the same ticket', async () => {
    const answers = [answer(CLASS_ID, 'Osztály', '10.B')];
    const helperRules = [deny({ message: 'A nem léphet be' }), catchAll()];
    const defaultRules = [allow()];
    const configs = [
      { rules: defaultRules, userId: null },
      { rules: helperRules, userId: HELPER_ID },
    ];

    // Helper A has an override that denies; nothing is written.
    const storeA = memoryStore([ticket({ answers })]);
    const chosenA = pickCheckinConfig(configs, HELPER_ID);
    const denied = await scan(storeA, chosenA?.rules ?? []);

    expect(denied).toMatchObject({
      message: 'A nem léphet be',
      status: 'not_granted',
    });
    expect(storeA.byId.get(TICKET_ID)?.checkedInAt).toBeNull();

    // Helper B has no override, so the event default admits the same ticket.
    const storeB = memoryStore([ticket({ answers })]);
    const chosenB = pickCheckinConfig(configs, OTHER_HELPER_ID);
    expect(chosenB?.userId).toBeNull();
    const admitted = await scan(storeB, chosenB?.rules ?? []);

    expect(admitted).toMatchObject({
      registrationId: REGISTRATION_ID,
      status: 'admitted',
      visitorName: 'Guest Visitor',
    });
    expect(storeB.byId.get(TICKET_ID)?.checkedInAt).toBe(FIRST_SCAN);
  });

  it('admits and shows only the name when no config exists at all', async () => {
    const store = memoryStore([ticket()]);
    const chosen = pickCheckinConfig([], HELPER_ID);

    expect(chosen).toBeNull();

    const result = await scan(store, chosen?.rules ?? []);

    expect(result).toEqual({
      answers: [],
      details: [],
      registrationId: REGISTRATION_ID,
      status: 'admitted',
      visitorName: 'Guest Visitor',
    });
    expect(store.byId.get(TICKET_ID)?.checkedInAt).toBe(FIRST_SCAN);
  });
});
