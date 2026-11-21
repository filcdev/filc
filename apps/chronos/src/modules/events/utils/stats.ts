import type { EventField } from '@filcdev/api/domains/events/fields';
import type {
  EventRegistrationRole,
  EventRegistrationStatus,
} from '@filcdev/api/domains/events/registration';
import type {
  EventAnswerSummary,
  EventStats,
} from '@filcdev/api/domains/events/stats';
import { and, count, eq, isNotNull } from 'drizzle-orm';
import { db } from '#database';
import {
  eventRegistration,
  eventRegistrationAnswer,
  eventTicket,
} from '#modules/events/schema';
import { eventFields } from '#modules/events/utils/events';
import { requireEvent } from '#modules/events/utils/participants';
import { toSeats } from '#modules/events/utils/seats';
import { env } from '#utils/environment';
import { DEFAULT_TIME_ZONE, formatDateInTimeZone } from '#utils/time-zone';

/** The columns the aggregations read, so the pure half never touches the db. */
export type RegistrationFact = {
  createdAt: Date;
  role: EventRegistrationRole;
  status: EventRegistrationStatus;
};

/** One `(field, value, count)` group as the answer query returns it. */
export type AnswerGroup = {
  count: number;
  fieldId: string;
  value: string;
};

type RegistrationSummary = Pick<EventStats, 'byRole' | 'byStatus' | 'perDay'>;

/**
 * Role and status counts plus the sparse per-day timeline, from the event's
 * registration rows. Every row counts in `byRole` and `byStatus` — a helper
 * takes no seat, but that is a seat rule, not a reason to hide them from the
 * organizer's totals. Cancelled rows count in `perDay`: they were registrations
 * when they were made.
 *
 * Days are bucketed in the school's timezone, not the host's: under UTC the
 * local components of an after-midnight Budapest registration would land on the
 * previous day. `timeZone` defaults to the school zone and callers pass
 * `env.timeZone`, like every other day boundary in Chronos.
 */
export const summarizeRegistrations = (
  rows: readonly RegistrationFact[],
  timeZone: string = DEFAULT_TIME_ZONE
): RegistrationSummary => {
  const byRole = { helper: 0, participant: 0, visitor: 0 };
  const byStatus = { cancelled: 0, confirmed: 0, pending: 0 };
  const days = new Map<string, number>();

  for (const row of rows) {
    byRole[row.role] += 1;
    byStatus[row.status] += 1;
    const day = formatDateInTimeZone(row.createdAt, timeZone);
    days.set(day, (days.get(day) ?? 0) + 1);
  }

  const perDay = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ count: total, date }));

  return { byRole, byStatus, perDay };
};

/**
 * The questions of the event with how many confirmed registrations answered
 * each. A select lists every configured option, zero included, so a chart never
 * has to invent a missing slice; an option removed after it was answered still
 * counts in `answered` but no longer has a slice of its own.
 */
export const summarizeAnswers = (
  fields: readonly EventField[],
  groups: readonly AnswerGroup[]
): EventAnswerSummary[] => {
  const counts = new Map<string, Map<string, number>>();
  for (const group of groups) {
    const byValue = counts.get(group.fieldId) ?? new Map<string, number>();
    byValue.set(group.value, group.count);
    counts.set(group.fieldId, byValue);
  }

  return fields.map((field) => {
    const byValue = counts.get(field.id) ?? new Map<string, number>();
    const answered = [...byValue.values()].reduce(
      (sum, value) => sum + value,
      0
    );
    const options =
      field.type === 'select'
        ? (field.options ?? []).map((value) => ({
            count: byValue.get(value) ?? 0,
            value,
          }))
        : null;

    return {
      answered,
      fieldId: field.id,
      label: field.label,
      options,
      type: field.type,
    };
  });
};

/** The seats the event's own rows account for: confirmed, helper excluded. */
export const takenSeats = (rows: readonly RegistrationFact[]): number =>
  rows.filter((row) => row.status === 'confirmed' && row.role !== 'helper')
    .length;

/**
 * The organizer's numbers for one event, read from its registrations. Three
 * queries whatever the size of the list: the rows, the confirmed answers and
 * the tickets the scanner has stamped.
 */
export const readEventStats = async (eventId: string): Promise<EventStats> => {
  const eventRow = await requireEvent(eventId);

  const [registrations, fields, answerGroups, checkedInRows] =
    await Promise.all([
      db
        .select({
          createdAt: eventRegistration.createdAt,
          role: eventRegistration.role,
          status: eventRegistration.status,
        })
        .from(eventRegistration)
        .where(eq(eventRegistration.eventId, eventId)),
      eventFields(eventId),
      // Only confirmed registrations answer: the people actually coming.
      db
        .select({
          count: count(),
          fieldId: eventRegistrationAnswer.fieldId,
          value: eventRegistrationAnswer.value,
        })
        .from(eventRegistrationAnswer)
        .innerJoin(
          eventRegistration,
          eq(eventRegistrationAnswer.registrationId, eventRegistration.id)
        )
        .where(
          and(
            eq(eventRegistration.eventId, eventId),
            eq(eventRegistration.status, 'confirmed')
          )
        )
        .groupBy(
          eventRegistrationAnswer.fieldId,
          eventRegistrationAnswer.value
        ),
      db
        .select({ value: count() })
        .from(eventTicket)
        .innerJoin(
          eventRegistration,
          eq(eventTicket.registrationId, eventRegistration.id)
        )
        .where(
          and(
            eq(eventRegistration.eventId, eventId),
            // A cancelled row keeps its ticket and its check-in, but the visitor
            // is no longer coming: without this the count disagrees with seats.
            eq(eventRegistration.status, 'confirmed'),
            isNotNull(eventTicket.checkedInAt)
          )
        ),
    ]);

  // The rows are already in memory, so the helper count costs no extra query.
  const confirmedHelpers = registrations.filter(
    (row) => row.role === 'helper' && row.status === 'confirmed'
  ).length;

  return {
    ...summarizeRegistrations(registrations, env.timeZone),
    answers: summarizeAnswers(
      fields,
      answerGroups.map((group) => ({
        count: Number(group.count),
        fieldId: group.fieldId,
        value: group.value,
      }))
    ),
    checkedIn: Number(checkedInRows[0]?.value ?? 0),
    confirmedHelpers,
    seats: toSeats(eventRow.capacity, takenSeats(registrations)),
  };
};
