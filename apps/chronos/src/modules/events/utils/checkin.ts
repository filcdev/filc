import type {
  EventCheckinAnswer,
  EventCheckinResult,
} from '@filcdev/api/domains/events/checkin';
import type { EventCheckinDisplay } from '@filcdev/api/domains/events/event';
import type { EventRegistrationStatus } from '@filcdev/api/domains/events/registration';

/**
 * One ticket as the check-in decision needs it. The store has already joined
 * the registration and resolved the visitor, so the decision is a value, not a
 * query — which is what lets the whole door state machine be tested without a
 * database.
 */
export type CheckinTicket = {
  /**
   * Every answer this registration holds, with its question's label. The door
   * configuration decides which of them a scan returns.
   */
  answers: EventCheckinAnswer[];
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
  | { status: 'invalid'; ticket: CheckinTicket }
  | { checkedInAt: Date; status: 'already_checked_in'; ticket: CheckinTicket }
  | { status: 'admitted'; ticket: CheckinTicket };

/**
 * The state one ticket is in for this event, or `not_found`.
 *
 * The event comparison is repeated here even though the store's query is
 * event-scoped: the "a foreign ticket looks like a missing one" rule is the
 * one that must not be lost to a query edit, so it is stated where it is
 * tested rather than only in SQL.
 *
 * A cancelled registration is judged before the check-in time: a place that
 * was cancelled is not a valid one, however it was scanned before.
 */
export const judgeCheckin = (
  ticket: CheckinTicket | null,
  eventId: string
): CheckinVerdict => {
  if (!ticket || ticket.eventId !== eventId) {
    return { status: 'not_found' };
  }
  if (ticket.registrationStatus === 'cancelled') {
    return { status: 'invalid', ticket };
  }
  if (ticket.checkedInAt) {
    return {
      checkedInAt: ticket.checkedInAt,
      status: 'already_checked_in',
      ticket,
    };
  }
  return { status: 'admitted', ticket };
};

/**
 * The answers the event configured, in the organizer's order. A question the
 * registration did not answer is simply absent, and an unconfigured one is
 * never sent, so the door cannot extract more than the list allows.
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
    );
};

const visitorOf = (
  ticket: CheckinTicket,
  display: EventCheckinDisplay,
  fields: readonly string[]
) => {
  // The setting is applied here, where the payload is built, not in the client:
  // a hidden field is left out entirely so no consumer can show it.
  const base = {
    answers: configuredAnswers(ticket, fields),
    registrationId: ticket.registrationId,
  };
  if (display === 'minimal') {
    return base;
  }
  if (display === 'name') {
    return { ...base, visitorName: ticket.visitorName };
  }
  return {
    ...base,
    visitorEmail: ticket.visitorEmail,
    visitorName: ticket.visitorName,
  };
};

/** The answer for a ticket this request did not write. */
const storedAnswer = (
  verdict: CheckinVerdict,
  display: EventCheckinDisplay,
  fields: readonly string[]
): EventCheckinResult => {
  if (verdict.status === 'invalid') {
    return { ...visitorOf(verdict.ticket, display, fields), status: 'invalid' };
  }
  if (verdict.status === 'already_checked_in') {
    return {
      ...visitorOf(verdict.ticket, display, fields),
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
 * with the first scan's time and helper instead of overwriting them.
 */
export const checkInTicket = async (
  store: CheckinStore,
  args: {
    code: string;
    /** What the event's check-in screen may reveal, applied to every outcome. */
    display: EventCheckinDisplay;
    eventId: string;
    /** The question ids whose answers the door returns, in the event's order. */
    fields: readonly string[];
    /** Injectable so a test can pin the first check-in's time. */
    now?: Date;
    userId: string;
  }
): Promise<EventCheckinResult> => {
  const { display, fields } = args;
  const first = judgeCheckin(await store.findTicket(args.code), args.eventId);

  if (first.status !== 'admitted') {
    return storedAnswer(first, display, fields);
  }

  const at = args.now ?? new Date();
  const written = await store.markCheckedIn(
    first.ticket.ticketId,
    args.userId,
    at
  );
  if (written) {
    return {
      ...visitorOf(first.ticket, display, fields),
      status: 'admitted',
    };
  }

  // Another scan won the write between the read and the update: answer the
  // state that is now stored, which is the same thing a later scan would see.
  const second = judgeCheckin(await store.findTicket(args.code), args.eventId);
  return storedAnswer(second, display, fields);
};
