import { describe, expect, it } from 'bun:test';
import {
  type GuestRegistrationDecision,
  type GuestRegistrationFacts,
  type HelperRegistrationDecision,
  type HelperRegistrationFacts,
  helperRegistrationWindow,
  judgeGuestRegistration,
  judgeHelperRegistration,
  judgeRegistration,
  type RegistrationDecision,
  type RegistrationFacts,
} from '#modules/events/utils/rules';

/** An event that is open, unlimited, untargeted and unbounded. */
const OPEN_EVENT: RegistrationFacts = {
  capacity: null,
  cohortIds: [],
  grade: 10,
  maxGrade: null,
  minGrade: null,
  now: new Date('2026-11-18T12:00:00.000Z'),
  pending: false,
  registered: false,
  registrationClosesAt: null,
  registrationEnabled: true,
  registrationOpensAt: null,
  roomCapacity: null,
  roomRequired: false,
  roomTaken: 0,
  taken: 0,
  viewerCohortId: 'cohort-a',
};

const judge = (overrides: Partial<RegistrationFacts>): RegistrationDecision =>
  judgeRegistration({ ...OPEN_EVENT, ...overrides });

const reasonOf = (decision: RegistrationDecision) =>
  decision.ok ? null : decision.reason;

describe('judgeRegistration', () => {
  it('accepts an open event the student is not yet on', () => {
    expect(judge({})).toEqual({ ok: true });
  });

  it('refuses every reason the contract names', () => {
    expect(reasonOf(judge({ registrationEnabled: false }))).toBe(
      'registration_disabled'
    );
    expect(
      reasonOf(
        judge({ registrationOpensAt: new Date('2026-12-01T00:00:00.000Z') })
      )
    ).toBe('not_open_yet');
    expect(
      reasonOf(
        judge({ registrationClosesAt: new Date('2026-11-01T00:00:00.000Z') })
      )
    ).toBe('closed');
    expect(reasonOf(judge({ cohortIds: ['cohort-b'] }))).toBe('wrong_cohort');
    expect(reasonOf(judge({ minGrade: 11 }))).toBe('grade_too_low');
    expect(reasonOf(judge({ maxGrade: 9 }))).toBe('grade_too_high');
    expect(reasonOf(judge({ registered: true }))).toBe('already_registered');
    expect(reasonOf(judge({ pending: true }))).toBe('pending_approval');
    expect(reasonOf(judge({ capacity: 3, taken: 3 }))).toBe('full');
  });

  it('treats a bounded event with an unreadable grade as grade_unknown', () => {
    expect(reasonOf(judge({ grade: null, minGrade: 9 }))).toBe('grade_unknown');
    // A bound on either side is enough: the grade decides both.
    expect(reasonOf(judge({ grade: null, maxGrade: 12 }))).toBe(
      'grade_unknown'
    );
    // Without a bound the grade is irrelevant, so it is not a refusal.
    expect(judge({ grade: null })).toEqual({ ok: true });
  });

  it('reads an empty cohort list as "every student"', () => {
    expect(judge({ cohortIds: [], viewerCohortId: null })).toEqual({
      ok: true,
    });
    expect(
      judge({ cohortIds: ['cohort-a'], viewerCohortId: 'cohort-a' })
    ).toEqual({ ok: true });
    // A student without a cohort cannot match a targeted event.
    expect(
      reasonOf(judge({ cohortIds: ['cohort-a'], viewerCohortId: null }))
    ).toBe('wrong_cohort');
  });

  it('answers the event before the caller', () => {
    // Closed beats already-registered: the student is told about the event, not
    // about their old row.
    expect(
      reasonOf(
        judge({
          registered: true,
          registrationClosesAt: new Date('2026-11-01T00:00:00.000Z'),
        })
      )
    ).toBe('closed');
    expect(reasonOf(judge({ capacity: 0, registered: true }))).toBe(
      'already_registered'
    );
  });

  it('counts the last seat as taken only when the count reaches capacity', () => {
    expect(judge({ capacity: 3, taken: 2 })).toEqual({ ok: true });
    expect(reasonOf(judge({ capacity: 3, taken: 3 }))).toBe('full');
    expect(judge({ capacity: null, taken: 1000 })).toEqual({ ok: true });
  });

  it('asks for a room once the event has one, and reports a full room apart', () => {
    expect(reasonOf(judge({ roomRequired: true }))).toBe('room_required');
    expect(
      reasonOf(judge({ roomCapacity: 2, roomRequired: true, roomTaken: 2 }))
    ).toBe('room_full');
    // The event's own limit is answered first: a full event is not a room.
    expect(
      reasonOf(judge({ capacity: 1, roomCapacity: 2, roomTaken: 2, taken: 1 }))
    ).toBe('full');
    expect(judge({ roomCapacity: 2, roomTaken: 1 })).toEqual({ ok: true });
  });
});

/** A published event that takes guests, is open, unlimited and empty. */
const OPEN_GUEST: GuestRegistrationFacts = {
  capacity: null,
  duplicateEmail: false,
  guestRegistrationEnabled: true,
  now: new Date('2026-11-18T12:00:00.000Z'),
  registrationClosesAt: null,
  registrationEnabled: true,
  registrationOpensAt: null,
  roomCapacity: null,
  roomRequired: false,
  roomTaken: 0,
  taken: 0,
};

const judgeGuest = (
  overrides: Partial<GuestRegistrationFacts>
): GuestRegistrationDecision =>
  judgeGuestRegistration({ ...OPEN_GUEST, ...overrides });

const guestReason = (decision: GuestRegistrationDecision) =>
  decision.ok ? null : decision.reason;

describe('judgeGuestRegistration', () => {
  it('accepts a guest on an open event with a free seat', () => {
    expect(judgeGuest({})).toEqual({ ok: true });
  });

  it('needs both the master switch and the guest switch', () => {
    expect(guestReason(judgeGuest({ registrationEnabled: false }))).toBe(
      'registration_disabled'
    );
    // The master switch is on, but this event does not take visitors.
    expect(guestReason(judgeGuest({ guestRegistrationEnabled: false }))).toBe(
      'guest_registration_disabled'
    );
  });

  it('uses the same window as the student form', () => {
    expect(
      guestReason(
        judgeGuest({
          registrationOpensAt: new Date('2026-12-01T00:00:00.000Z'),
        })
      )
    ).toBe('not_open_yet');
    expect(
      guestReason(
        judgeGuest({
          registrationClosesAt: new Date('2026-11-01T00:00:00.000Z'),
        })
      )
    ).toBe('closed');
  });

  it('refuses a second confirmed place for the same address', () => {
    expect(guestReason(judgeGuest({ duplicateEmail: true }))).toBe(
      'duplicate_email'
    );
  });

  it('counts a free seat, and a taken one', () => {
    expect(judgeGuest({ capacity: 2, taken: 1 })).toEqual({ ok: true });
    expect(guestReason(judgeGuest({ capacity: 2, taken: 2 }))).toBe('full');
    expect(judgeGuest({ capacity: null, taken: 500 })).toEqual({ ok: true });
  });

  it('asks a visitor for a room too, and reports a full room apart', () => {
    expect(guestReason(judgeGuest({ roomRequired: true }))).toBe(
      'room_required'
    );
    expect(
      guestReason(
        judgeGuest({ roomCapacity: 1, roomRequired: true, roomTaken: 1 })
      )
    ).toBe('room_full');
    expect(judgeGuest({ roomCapacity: 2, roomTaken: 1 })).toEqual({ ok: true });
  });

  it('answers the event before the caller', () => {
    // A closed event beats the duplicate address: the parent is told about the
    // event, not about their old row.
    expect(
      guestReason(
        judgeGuest({
          duplicateEmail: true,
          guestRegistrationEnabled: false,
        })
      )
    ).toBe('guest_registration_disabled');
  });
});

/** A published event that takes helpers, on the shared window, open now. */
const OPEN_HELPER: HelperRegistrationFacts = {
  confirmedHelpers: 0,
  grade: 10,
  helperCapacity: null,
  helperMaxGrade: null,
  helperMinGrade: null,
  helperRegistrationClosesAt: null,
  helperRegistrationEnabled: true,
  helperRegistrationOpensAt: null,
  helperRegistrationSeparateWindow: false,
  maxGrade: null,
  minGrade: null,
  now: new Date('2026-11-18T12:00:00.000Z'),
  pending: false,
  registered: false,
  registrationClosesAt: null,
  registrationEnabled: true,
  registrationOpensAt: null,
};

const judgeHelper = (
  overrides: Partial<HelperRegistrationFacts>
): HelperRegistrationDecision =>
  judgeHelperRegistration({ ...OPEN_HELPER, ...overrides });

const helperReason = (decision: HelperRegistrationDecision) =>
  decision.ok ? null : decision.reason;

describe('judgeHelperRegistration', () => {
  it('accepts a helper on an enabled, open event', () => {
    expect(judgeHelper({})).toEqual({ ok: true });
  });

  it('needs the master switch and the helper switch', () => {
    expect(helperReason(judgeHelper({ registrationEnabled: false }))).toBe(
      'registration_disabled'
    );
    expect(
      helperReason(judgeHelper({ helperRegistrationEnabled: false }))
    ).toBe('helper_registration_disabled');
  });

  it('uses the shared window while the separate switch is off', () => {
    // The helper columns are set but inert; the participant window decides.
    expect(
      helperReason(
        judgeHelper({
          helperRegistrationClosesAt: new Date('2026-12-01T00:00:00.000Z'),
          registrationClosesAt: new Date('2026-11-01T00:00:00.000Z'),
        })
      )
    ).toBe('closed');
    expect(
      helperReason(
        judgeHelper({
          helperRegistrationOpensAt: new Date('2026-11-01T00:00:00.000Z'),
          registrationOpensAt: new Date('2026-12-01T00:00:00.000Z'),
        })
      )
    ).toBe('not_open_yet');
  });

  it('uses the helper window once the separate switch is on', () => {
    // The shared window is closed, the helper window is open: helpers may sign
    // up because the separate window is the one that applies.
    expect(
      judgeHelper({
        helperRegistrationClosesAt: new Date('2026-12-01T00:00:00.000Z'),
        helperRegistrationSeparateWindow: true,
        registrationClosesAt: new Date('2026-11-01T00:00:00.000Z'),
      })
    ).toEqual({ ok: true });
    // And the reverse: the shared window is open, the helper window has closed.
    expect(
      helperReason(
        judgeHelper({
          helperRegistrationClosesAt: new Date('2026-11-01T00:00:00.000Z'),
          helperRegistrationSeparateWindow: true,
        })
      )
    ).toBe('closed');
    expect(
      helperReason(
        judgeHelper({
          helperRegistrationOpensAt: new Date('2026-12-01T00:00:00.000Z'),
          helperRegistrationSeparateWindow: true,
        })
      )
    ).toBe('not_open_yet');
  });

  it('selects the window pair from the switch', () => {
    const separate = helperRegistrationWindow({
      helperRegistrationClosesAt: new Date('2026-12-02T00:00:00.000Z'),
      helperRegistrationOpensAt: new Date('2026-12-01T00:00:00.000Z'),
      helperRegistrationSeparateWindow: true,
      registrationClosesAt: new Date('2026-11-02T00:00:00.000Z'),
      registrationOpensAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    expect(separate.opensAt).toEqual(new Date('2026-12-01T00:00:00.000Z'));
    expect(separate.closesAt).toEqual(new Date('2026-12-02T00:00:00.000Z'));

    const shared = helperRegistrationWindow({
      ...OPEN_HELPER,
      helperRegistrationClosesAt: new Date('2026-12-02T00:00:00.000Z'),
      helperRegistrationOpensAt: new Date('2026-12-01T00:00:00.000Z'),
      registrationClosesAt: new Date('2026-11-02T00:00:00.000Z'),
      registrationOpensAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    expect(shared.opensAt).toEqual(new Date('2026-11-01T00:00:00.000Z'));
    expect(shared.closesAt).toEqual(new Date('2026-11-02T00:00:00.000Z'));
  });

  it('answers a pending or confirmed row before accepting another', () => {
    expect(helperReason(judgeHelper({ pending: true }))).toBe(
      'pending_approval'
    );
    expect(helperReason(judgeHelper({ registered: true }))).toBe(
      'already_registered'
    );
  });

  it('refuses only when confirmed helpers fill the cap', () => {
    expect(
      helperReason(judgeHelper({ confirmedHelpers: 2, helperCapacity: 2 }))
    ).toBe('helper_full');
    expect(
      judgeHelper({ confirmedHelpers: 1, helperCapacity: 2, pending: true })
    ).toEqual({ ok: false, reason: 'pending_approval' });
    expect(
      judgeHelper({ confirmedHelpers: 1, helperCapacity: 2, pending: false })
    ).toEqual({ ok: true });
  });

  it('uses the helper band when either helper bound is set', () => {
    // A helper band of its own overrides the event band, even on the side the
    // event happens to bound.
    expect(helperReason(judgeHelper({ helperMinGrade: 11 }))).toBe(
      'grade_too_low'
    );
    expect(helperReason(judgeHelper({ helperMaxGrade: 9 }))).toBe(
      'grade_too_high'
    );
    // The unset side of a helper band is unbounded: the event's maxGrade does
    // not leak into a helper band that only has a minimum.
    expect(
      judgeHelper({ helperMinGrade: 9, maxGrade: 10, minGrade: 12 })
    ).toEqual({ ok: true });
    expect(
      helperReason(judgeHelper({ helperMinGrade: 11, maxGrade: 13 }))
    ).toBe('grade_too_low');
  });

  it('falls back to the event band when both helper bounds are null', () => {
    expect(helperReason(judgeHelper({ maxGrade: 13, minGrade: 11 }))).toBe(
      'grade_too_low'
    );
    expect(helperReason(judgeHelper({ maxGrade: 9, minGrade: null }))).toBe(
      'grade_too_high'
    );
    expect(helperReason(judgeHelper({ maxGrade: null, minGrade: 11 }))).toBe(
      'grade_too_low'
    );
  });

  it('refuses an unreadable grade only when a band applies', () => {
    expect(helperReason(judgeHelper({ grade: null, helperMinGrade: 9 }))).toBe(
      'grade_unknown'
    );
    expect(helperReason(judgeHelper({ grade: null, maxGrade: 12 }))).toBe(
      'grade_unknown'
    );
    // No helper band and no event band: the grade is irrelevant.
    expect(judgeHelper({ grade: null })).toEqual({ ok: true });
  });

  it('never refuses a helper for capacity', () => {
    // Capacity is not part of the facts: a full event still takes helpers.
    expect(judgeHelper({ helperRegistrationEnabled: true })).toEqual({
      ok: true,
    });
  });
});
