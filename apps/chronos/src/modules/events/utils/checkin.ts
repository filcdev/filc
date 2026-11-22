import type {
  EventCheckinAnswer,
  EventCheckinDetail,
  EventCheckinResult,
} from '@filcdev/api/domains/events/checkin';
import type { EventFieldType } from '@filcdev/api/domains/events/fields';
import type { EventRegistrationStatus } from '@filcdev/api/domains/events/registration';
import type {
  EventCheckinRule,
  EventCheckinShow,
} from '@filcdev/api/domains/events/rules';
import { matchCheckinRule } from '#modules/events/utils/door-rules';

/** What the scanner may reveal when no rule decided (a cancelled ticket). */
const HIDDEN_SHOW: EventCheckinShow = {
  email: false,
  fieldIds: [],
  name: false,
};

/** The door's answer when an event somehow has no rule list at all. */
const FALLBACK_SHOW: EventCheckinShow = {
  email: false,
  fieldIds: [],
  name: true,
};

/**
 * One answer of the scanned registration, with its question's label and type.
 * The type is what lets the rule evaluator compare a number numerically and a
 * checkbox as a tick.
 */
export type CheckinAnswer = {
  fieldId: string;
  label: string;
  type: EventFieldType;
  value: string;
};

/**
 * One ticket as the check-in decision needs it. The store has already joined
 * the registration, its answers and the visitor, so the decision is a value,
 * not a query — which is what lets the whole door state machine be tested
 * without a database.
 */
export type CheckinTicket = {
  /** Every answer this registration holds, with its question's label. */
  answers: CheckinAnswer[];
  /** Null until someone scans it; the first scan's time afterwards. */
  checkedInAt: Date | null;
  /** The colleague who scanned first; null while unchecked or deleted. */
  checkedInByName: string | null;
  eventId: string;
  registrationId: string;
  registrationStatus: EventRegistrationStatus;
  /** The ticket id, which is also the QR payload. */
  ticketId: string;
  visitorEmail: string;
  visitorName: string;
};

/** What one scan asks the database for. */
export type CheckinStore = {
  /** The ticket with its visitor, whatever event it belongs to; null if none. */
  findTicket: (code: string) => Promise<CheckinTicket | null>;
  /**
   * Writes the first check-in only. `true` when this call set it, `false` when
   * another scan got there first (or the row is gone), which is what makes a
   * double scan idempotent.
   */
  markCheckedIn: (
    ticketId: string,
    userId: string,
    at: Date
  ) => Promise<boolean>;
};

export type CheckinVerdict =
  | { status: 'not_found' }
  | { show: EventCheckinShow; status: 'invalid'; ticket: CheckinTicket }
  | {
      message: string;
      show: EventCheckinShow;
      status: 'not_granted';
      ticket: CheckinTicket;
    }
  | {
      checkedInAt: Date;
      show: EventCheckinShow;
      status: 'already_checked_in';
      ticket: CheckinTicket;
    }
  | { show: EventCheckinShow; status: 'admitted'; ticket: CheckinTicket };

/**
 * The state one ticket is in for this event, or `not_found`.
 *
 * The event comparison is repeated here even though the store's query is
 * event-scoped: the "a foreign ticket looks like a missing one" rule is the
 * one that must not be lost to a query edit, so it is stated where it is
 * tested rather than only in SQL.
 *
 * A cancelled registration is judged before the rules: a place that was
 * cancelled is not a valid one, however it was scanned before. Every confirmed
 * ticket then walks the rule list; a deny wins before the scan-state branch,
 * so a denied ticket is never read as "already entered".
 */
export const judgeCheckin = (
  ticket: CheckinTicket | null,
  eventId: string,
  rules: readonly EventCheckinRule[]
): CheckinVerdict => {
  if (!ticket || ticket.eventId !== eventId) {
    return { status: 'not_found' };
  }
  if (ticket.registrationStatus === 'cancelled') {
    return { show: HIDDEN_SHOW, status: 'invalid', ticket };
  }

  const rule = matchCheckinRule(rules, ticket.answers);
  if (rule?.action === 'deny') {
    return {
      message: rule.message,
      show: rule.show,
      status: 'not_granted',
      ticket,
    };
  }
  const show = rule?.show ?? FALLBACK_SHOW;

  if (ticket.checkedInAt) {
    return {
      checkedInAt: ticket.checkedInAt,
      show,
      status: 'already_checked_in',
      ticket,
    };
  }
  return { show, status: 'admitted', ticket };
};

/**
 * The answers a rule chose to show, in the rule's order. A question the
 * registration did not answer is simply absent, and an unconfigured one is
 * never sent, so the door cannot extract more than the rule allows. A checkbox
 * is a boolean here too, so the scanner says yes or no rather than `true`.
 */
const configuredAnswers = (
  ticket: CheckinTicket,
  fields: readonly string[]
): EventCheckinAnswer[] => {
  const order = new Map(fields.map((fieldId, index) => [fieldId, index]));
  return ticket.answers
    .filter((answer) => order.has(answer.fieldId))
    .sort(
      (left, right) =>
        (order.get(left.fieldId) ?? 0) - (order.get(right.fieldId) ?? 0)
    )
    .map(({ fieldId, label, type, value }) => ({
      fieldId,
      label,
      value: type === 'checkbox' ? value === 'true' : value,
    }));
};

/**
 * Every answer of the registration for the scanner's details panel. A checkbox
 * is a boolean so the scanner says yes or no; every other value is the
 * visitor's own text, verbatim. The visitor's email is never part of this list.
 */
const detailsOf = (ticket: CheckinTicket): EventCheckinDetail[] =>
  ticket.answers.map((answer) => ({
    fieldId: answer.fieldId,
    label: answer.label,
    type: answer.type,
    value: answer.type === 'checkbox' ? answer.value === 'true' : answer.value,
  }));

const visitorOf = (ticket: CheckinTicket, show: EventCheckinShow) => {
  // The rule is applied here, where the payload is built, not in the client: a
  // hidden field is left out entirely so no consumer can show it.
  const base = {
    answers: configuredAnswers(ticket, show.fieldIds),
    details: detailsOf(ticket),
    registrationId: ticket.registrationId,
  };
  const identity: { visitorEmail?: string; visitorName?: string } = {};
  if (show.name) {
    identity.visitorName = ticket.visitorName;
  }
  if (show.email) {
    identity.visitorEmail = ticket.visitorEmail;
  }
  return { ...base, ...identity };
};

/** The answer for a ticket this request did not write. */
const storedAnswer = (verdict: CheckinVerdict): EventCheckinResult => {
  if (verdict.status === 'invalid') {
    return { ...visitorOf(verdict.ticket, verdict.show), status: 'invalid' };
  }
  if (verdict.status === 'not_granted') {
    return {
      ...visitorOf(verdict.ticket, verdict.show),
      message: verdict.message,
      status: 'not_granted',
    };
  }
  if (verdict.status === 'already_checked_in') {
    return {
      ...visitorOf(verdict.ticket, verdict.show),
      checkedInAt: verdict.checkedInAt,
      checkedInByName: verdict.ticket.checkedInByName,
      status: 'already_checked_in',
    };
  }
  // `admitted` here means the second read still saw an unchecked ticket: the
  // row changed under this request, and a phantom admission is worse than
  // sending the helper to look again.
  return { status: 'not_found' };
};

/**
 * One door scan: read the ticket, decide, and write the first check-in.
 *
 * Idempotent by construction — the write only lands when `checked_in_at` is
 * still null, so the second scan of the same code answers `already_checked_in`
 * with the first scan's time and helper instead of overwriting them. A rule
 * that denies writes nothing, so the same ticket can be admitted later once
 * the registration is corrected.
 */
export const checkInTicket = async (
  store: CheckinStore,
  args: {
    code: string;
    eventId: string;
    /** The event's ordered door rules; the first match decides. */
    rules: readonly EventCheckinRule[];
    /** Injectable so a test can pin the first check-in's time. */
    now?: Date;
    userId: string;
  }
): Promise<EventCheckinResult> => {
  const first = judgeCheckin(
    await store.findTicket(args.code),
    args.eventId,
    args.rules
  );

  if (first.status !== 'admitted') {
    return storedAnswer(first);
  }

  const at = args.now ?? new Date();
  const written = await store.markCheckedIn(
    first.ticket.ticketId,
    args.userId,
    at
  );
  if (written) {
    return { ...visitorOf(first.ticket, first.show), status: 'admitted' };
  }

  // Another scan won the write between the read and the update: answer the
  // state that is now stored, which is the same thing a later scan would see.
  const second = judgeCheckin(
    await store.findTicket(args.code),
    args.eventId,
    args.rules
  );
  return storedAnswer(second);
};
