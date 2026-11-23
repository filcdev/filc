import type { EventEligibilityReason } from '@filcdev/api/domains/events/event';

/** Everything the rules can refuse with; `sign_in_required` belongs to the views. */
export type RegistrationRefusal = Exclude<
  EventEligibilityReason,
  'sign_in_required' | null
>;

export type RegistrationDecision =
  | { ok: true }
  | { ok: false; reason: RegistrationRefusal };

/**
 * Everything the decision needs, all of it from the event's own columns plus
 * what the caller is and has already done.
 */
export type RegistrationFacts = {
  capacity: number | null;
  /** Registration scope: empty means every student. */
  cohortIds: readonly string[];
  /** The student's grade, null when their cohort does not name one. */
  grade: number | null;
  maxGrade: number | null;
  minGrade: number | null;
  now: Date;
  /** The caller already holds a pending helper signup. */
  pending: boolean;
  registrationClosesAt: Date | null;
  registrationEnabled: boolean;
  registrationOpensAt: Date | null;
  /** The caller already holds a confirmed registration. */
  registered: boolean;
  /**
   * The chosen room's seat count; null when no room was chosen (or the event
   * has none). Together with `roomRequired` this is what tells "choose a room"
   * apart from "this room is full".
   */
  roomCapacity: number | null;
  /** Whether the event has rooms, so a participant must choose one. */
  roomRequired: boolean;
  /** The chosen room's confirmed seats; 0 when no room was chosen. */
  roomTaken: number;
  /** Confirmed participants; helpers are not seats. */
  taken: number;
  viewerCohortId: string | null;
};

/* -------------------------------------------------------------------------- */
/* Guests                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Everything a guest signup is judged on. A visitor has no account, so there is
 * no cohort and no grade here: the event's own switches, its window, the seat
 * count and whether this address already holds a confirmed place.
 */
export type GuestRegistrationFacts = {
  capacity: number | null;
  /** Set only when an earlier confirmed row exists for this address. */
  duplicateEmail: boolean;
  guestRegistrationEnabled: boolean;
  now: Date;
  registrationClosesAt: Date | null;
  /** The event's master registration switch. */
  registrationEnabled: boolean;
  registrationOpensAt: Date | null;
  /** The chosen room's seat count; null when none was chosen. */
  roomCapacity: number | null;
  /** Whether the event has rooms, so a visitor must choose one too. */
  roomRequired: boolean;
  /** The chosen room's confirmed seats; 0 when no room was chosen. */
  roomTaken: number;
  /** Confirmed seats, visitors and participants alike. */
  taken: number;
};

/** Why a guest may not sign up. Separate from the student reasons: no cohort, no grade. */
export type GuestRefusal =
  | 'registration_disabled'
  | 'guest_registration_disabled'
  | 'not_open_yet'
  | 'closed'
  | 'duplicate_email'
  | 'full'
  | 'room_required'
  | 'room_full';

export type GuestRegistrationDecision =
  | { ok: true }
  | { ok: false; reason: GuestRefusal };

const refuseGuest = (reason: GuestRefusal): GuestRegistrationDecision => ({
  ok: false,
  reason,
});

/**
 * Whether a visitor may sign up.
 *
 * Both the event's master switch and its guest switch must be on: a guest is a
 * kind of registration, so "registration is off" closes the visitor form too.
 * The window is the same one students get, and a seat is a seat — a visitor
 * consumes one, only a helper does not.
 */
export const judgeGuestRegistration = (
  facts: GuestRegistrationFacts
): GuestRegistrationDecision => {
  if (!facts.registrationEnabled) {
    return refuseGuest('registration_disabled');
  }
  if (!facts.guestRegistrationEnabled) {
    return refuseGuest('guest_registration_disabled');
  }
  if (facts.registrationOpensAt && facts.now < facts.registrationOpensAt) {
    return refuseGuest('not_open_yet');
  }
  if (facts.registrationClosesAt && facts.now > facts.registrationClosesAt) {
    return refuseGuest('closed');
  }
  if (facts.duplicateEmail) {
    return refuseGuest('duplicate_email');
  }
  if (facts.capacity != null && facts.taken >= facts.capacity) {
    return refuseGuest('full');
  }
  // A visitor takes a seat like a student, so a roomed event asks them for a
  // room too; without one there is nothing to judge the room's capacity on.
  if (facts.roomRequired && facts.roomCapacity == null) {
    return refuseGuest('room_required');
  }
  if (facts.roomCapacity != null && facts.roomTaken >= facts.roomCapacity) {
    return refuseGuest('room_full');
  }
  return { ok: true };
};

const refuse = (reason: RegistrationRefusal): RegistrationDecision => ({
  ok: false,
  reason,
});

/** The event's own window: closed and not-yet-open are about the event only. */
const windowRefusal = (
  facts: RegistrationFacts
): RegistrationRefusal | null => {
  if (facts.registrationOpensAt && facts.now < facts.registrationOpensAt) {
    return 'not_open_yet';
  }
  if (facts.registrationClosesAt && facts.now > facts.registrationClosesAt) {
    return 'closed';
  }
  return null;
};

/** Registration scope, not visibility: an empty list admits every student. */
const cohortRefusal = (
  facts: RegistrationFacts
): RegistrationRefusal | null => {
  if (facts.cohortIds.length === 0) {
    return null;
  }
  if (facts.viewerCohortId && facts.cohortIds.includes(facts.viewerCohortId)) {
    return null;
  }
  return 'wrong_cohort';
};

/**
 * The grade bounds, answered only when the event has one: a bound with no
 * readable grade refuses as unknown rather than guessing, and an event without
 * bounds accepts a student whose grade we could not read.
 */
const gradeRefusal = (facts: RegistrationFacts): RegistrationRefusal | null => {
  if (facts.minGrade == null && facts.maxGrade == null) {
    return null;
  }
  if (facts.grade == null) {
    return 'grade_unknown';
  }
  if (facts.minGrade != null && facts.grade < facts.minGrade) {
    return 'grade_too_low';
  }
  if (facts.maxGrade != null && facts.grade > facts.maxGrade) {
    return 'grade_too_high';
  }
  return null;
};

/**
 * Whether a student may register, and if not, why.
 *
 * Precedence is deliberate: the event's own switch and window are answered
 * before anything about the caller, so a student is never told "you are not
 * eligible" about an event that is simply closed.
 */
export const judgeRegistration = (
  facts: RegistrationFacts
): RegistrationDecision => {
  if (!facts.registrationEnabled) {
    return refuse('registration_disabled');
  }

  const refusals = [
    windowRefusal(facts),
    cohortRefusal(facts),
    gradeRefusal(facts),
  ];
  const first = refusals.find((reason) => reason !== null);
  if (first) {
    return refuse(first);
  }

  if (facts.pending) {
    return refuse('pending_approval');
  }
  if (facts.registered) {
    return refuse('already_registered');
  }
  if (facts.capacity != null && facts.taken >= facts.capacity) {
    return refuse('full');
  }
  // The room comes after the event: a full event is the event's answer, and a
  // roomed event with no room chosen cannot be judged against a capacity yet.
  if (facts.roomRequired && facts.roomCapacity == null) {
    return refuse('room_required');
  }
  if (facts.roomCapacity != null && facts.roomTaken >= facts.roomCapacity) {
    return refuse('room_full');
  }

  return { ok: true };
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Everything a helper signup is judged on. A helper is a student, but unlike a
 * participant they do not take a seat and the event's cohort/grade target does
 * not apply: only the two switches, the chosen window and the caller's own row.
 */
export type HelperRegistrationFacts = {
  /** The student's grade, null when their cohort does not name one. */
  grade: number | null;
  /**
   * The helper band. Either bound governs helpers when set; with both null the
   * event's own `minGrade`/`maxGrade` below apply to them.
   */
  helperMaxGrade: number | null;
  helperMinGrade: number | null;
  helperRegistrationClosesAt: Date | null;
  helperRegistrationEnabled: boolean;
  helperRegistrationOpensAt: Date | null;
  helperRegistrationSeparateWindow: boolean;
  /** The event's participant bounds, the helper fallback when its own are null. */
  maxGrade: number | null;
  minGrade: number | null;
  now: Date;
  /** The caller already holds a pending row on this event. */
  pending: boolean;
  /** The caller already holds a confirmed row on this event. */
  registered: boolean;
  registrationClosesAt: Date | null;
  /** The event's master registration switch. */
  registrationEnabled: boolean;
  registrationOpensAt: Date | null;
};

export type HelperRefusal =
  | 'registration_disabled'
  | 'helper_registration_disabled'
  | 'not_open_yet'
  | 'closed'
  | 'grade_too_low'
  | 'grade_too_high'
  | 'grade_unknown'
  | 'already_registered'
  | 'pending_approval';

export type HelperRegistrationDecision =
  | { ok: true }
  | { ok: false; reason: HelperRefusal };

export type RegistrationWindow = {
  closesAt: Date | null;
  opensAt: Date | null;
};

/**
 * The window a helper signup is judged against. The separate switch is the
 * whole rule: until it is on, the helper window columns are inert and helpers
 * share the participant window.
 */
export const helperRegistrationWindow = (
  facts: Omit<HelperRegistrationFacts, 'now' | 'pending' | 'registered'>
): RegistrationWindow =>
  facts.helperRegistrationSeparateWindow
    ? {
        closesAt: facts.helperRegistrationClosesAt,
        opensAt: facts.helperRegistrationOpensAt,
      }
    : {
        closesAt: facts.registrationClosesAt,
        opensAt: facts.registrationOpensAt,
      };

const refuseHelper = (reason: HelperRefusal): HelperRegistrationDecision => ({
  ok: false,
  reason,
});

/**
 * The grade band a helper is judged against, and precedence stated once:
 *
 * 1. When either helper bound is set, the helper pair governs — the unset side
 *    of that pair is simply unbounded, even if the event has a bound there.
 * 2. When both helper bounds are null, the event's own participant bounds
 *    apply, so an event that is 11+ for participants is 11+ for helpers by
 *    default.
 * 3. When both pairs are null, any readable grade passes.
 *
 * A bound with no readable grade refuses as `grade_unknown`, exactly like the
 * participant rule: guessing a grade either bars a student who qualifies or
 * admits one who does not.
 */
const helperGradeRefusal = (
  facts: HelperRegistrationFacts
): HelperRefusal | null => {
  const usesHelperBand =
    facts.helperMinGrade != null || facts.helperMaxGrade != null;
  const min = usesHelperBand ? facts.helperMinGrade : facts.minGrade;
  const max = usesHelperBand ? facts.helperMaxGrade : facts.maxGrade;

  if (min == null && max == null) {
    return null;
  }
  if (facts.grade == null) {
    return 'grade_unknown';
  }
  if (min != null && facts.grade < min) {
    return 'grade_too_low';
  }
  if (max != null && facts.grade > max) {
    return 'grade_too_high';
  }
  return null;
};

/**
 * Whether a student may sign up as a helper.
 *
 * Capacity is deliberately absent: a helper never fills a seat, so an event
 * that is full for participants still takes helpers. Eligibility is answered
 * before the form, exactly like the participant path.
 */
export const judgeHelperRegistration = (
  facts: HelperRegistrationFacts
): HelperRegistrationDecision => {
  if (!facts.registrationEnabled) {
    return refuseHelper('registration_disabled');
  }
  if (!facts.helperRegistrationEnabled) {
    return refuseHelper('helper_registration_disabled');
  }

  const { opensAt, closesAt } = helperRegistrationWindow(facts);
  if (opensAt && facts.now < opensAt) {
    return refuseHelper('not_open_yet');
  }
  if (closesAt && facts.now > closesAt) {
    return refuseHelper('closed');
  }
  // The grade band is an event-level rule, answered before the caller's own
  // row, exactly like the participant path.
  const gradeRefusalForTheHelper = helperGradeRefusal(facts);
  if (gradeRefusalForTheHelper) {
    return refuseHelper(gradeRefusalForTheHelper);
  }
  if (facts.pending) {
    return refuseHelper('pending_approval');
  }
  if (facts.registered) {
    return refuseHelper('already_registered');
  }

  return { ok: true };
};
