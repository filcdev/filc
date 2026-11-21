import type {
  EventEligibility,
  EventItem,
  EventSeats,
} from '@filcdev/api/domains/events/event';
import type {
  EventField,
  EventFieldAudience,
} from '@filcdev/api/domains/events/fields';
import { permissions } from '@filcdev/api/permissions';
import { eq } from 'drizzle-orm';
import type { db as Db } from '#database';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { type event, eventField } from '#modules/events/schema';
import { cohortGrade } from '#modules/events/utils/grade';
import { confirmedRegistration } from '#modules/events/utils/registrations';
import {
  judgeHelperRegistration,
  judgeRegistration,
} from '#modules/events/utils/rules';
import { seatCount, toSeats } from '#modules/events/utils/seats';
import { cohort } from '#modules/timetable/schema';
import { userHasPermission } from '#utils/authorization';

type TxOrDb =
  | typeof db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

/** Whether the caller may see drafts and archived events. */
export const canManageEvents = async (
  userId: string | undefined
): Promise<boolean> =>
  userId ? userHasPermission(userId, permissions.eventsManage) : false;

/** The event columns the activity log diffs on update. */
export const EVENT_AUDIT_FIELDS = [
  'capacity',
  'category',
  'checkinRules',
  'cohortIds',
  'description',
  'endsAt',
  'guestRegistrationEnabled',
  'helperRegistrationClosesAt',
  'helperRegistrationEnabled',
  'helperCapacity',
  'helperMaxGrade',
  'helperMinGrade',
  'helperRegistrationOpensAt',
  'helperRegistrationSeparateWindow',
  'maxGrade',
  'minGrade',
  'registrationClosesAt',
  'registrationEnabled',
  'registrationOpensAt',
  'startsAt',
  'status',
  'title',
] as const;

export const eventFields = async (eventId: string) =>
  db
    .select()
    .from(eventField)
    .where(eq(eventField.eventId, eventId))
    // Position is the organizer's order; the id breaks a duplicate position so
    // the form and the export agree on which question comes first.
    .orderBy(eventField.position, eventField.id);

/**
 * Whether a question belongs on a form aimed at any of these audiences. The
 * filter runs in one place so the form, the answer validation and the
 * answer validation cannot disagree about who sees a question.
 */
export const fieldHasAudience = (
  field: Pick<EventField, 'audiences'>,
  audiences: readonly EventFieldAudience[]
): boolean => audiences.some((audience) => field.audiences.includes(audience));

/**
 * The questions on the forms aimed at any of `audiences`, keeping the event's
 * order. Pure so the filter the forms use can be asserted without a database.
 */
export const filterFieldsForAudiences = (
  fields: readonly EventField[],
  audiences: readonly EventFieldAudience[]
): EventField[] => fields.filter((field) => fieldHasAudience(field, audiences));

/** The event's questions on the forms aimed at any of `audiences`, in order. */
const fieldsForAudiences = async (
  eventId: string,
  audiences: readonly EventFieldAudience[],
  tx?: TxOrDb
): Promise<EventField[]> =>
  filterFieldsForAudiences(
    await (tx ?? db)
      .select()
      .from(eventField)
      .where(eq(eventField.eventId, eventId))
      .orderBy(eventField.position, eventField.id),
    audiences
  );

/**
 * The questions a visitor (a guest) answers on signup: those whose audiences
 * include `guest`.
 */
export const guestEventFields = (
  eventId: string,
  tx?: TxOrDb
): Promise<EventField[]> => fieldsForAudiences(eventId, ['guest'], tx);

/**
 * The questions a signed-in student answers on signup. A helper submits
 * through the same form, so a question aimed at either audience is shown — and
 * validated — for both.
 */
export const studentEventFields = (
  eventId: string,
  tx?: TxOrDb
): Promise<EventField[]> =>
  fieldsForAudiences(eventId, ['student', 'helper'], tx);

/**
 * Who is asking. Anonymous visitors have no cohort and no grade, which is the
 * whole difference between "not eligible to register" and "sign in first".
 */
export type EventViewer = {
  cohortId: string | null;
  grade: number | null;
  userId: string | null;
};

/** A caller's cohort and the grade it names; anonymous has neither. */
export const resolveEventViewer = async (
  userId: string | undefined
): Promise<EventViewer> => {
  if (!userId) {
    return { cohortId: null, grade: null, userId: null };
  }

  const [row] = await db
    .select({ cohortId: user.cohortId })
    .from(user)
    .where(eq(user.id, userId));
  const cohortId = row?.cohortId ?? null;
  if (!cohortId) {
    return { cohortId: null, grade: null, userId };
  }

  const [label] = await db
    .select({ name: cohort.name, short: cohort.short })
    .from(cohort)
    .where(eq(cohort.id, cohortId));

  return { cohortId, grade: cohortGrade(label), userId };
};

/**
 * Whether this viewer may register for this event, judged against the row and
 * what they have already done. Anonymous callers are told to sign in rather
 * than being handed a rule they cannot act on.
 */
export const eligibilityFor = (
  row: typeof event.$inferSelect,
  viewer: EventViewer,
  facts: { pending: boolean; registered: boolean; taken: number },
  now: Date = new Date()
): EventEligibility => {
  if (!viewer.userId) {
    return { eligible: false, reason: 'sign_in_required' };
  }

  const decision = judgeRegistration({
    capacity: row.capacity,
    cohortIds: row.cohortIds,
    grade: viewer.grade,
    maxGrade: row.maxGrade,
    minGrade: row.minGrade,
    now,
    pending: facts.pending,
    registered: facts.registered,
    registrationClosesAt: row.registrationClosesAt,
    registrationEnabled: row.registrationEnabled,
    registrationOpensAt: row.registrationOpensAt,
    taken: facts.taken,
    viewerCohortId: viewer.cohortId,
  });

  return decision.ok
    ? { eligible: true, reason: null }
    : { eligible: false, reason: decision.reason };
};

/**
 * Whether this viewer may sign up as a helper. Same viewer rules as a
 * participant, but the helper decision ignores seats, cohort and its own
 * windows are the helper ones (or the shared pair).
 */
export const helperEligibilityFor = (
  row: typeof event.$inferSelect,
  viewer: EventViewer,
  facts: { confirmedHelpers: number; pending: boolean; registered: boolean },
  now: Date = new Date()
): EventEligibility => {
  if (!viewer.userId) {
    return { eligible: false, reason: 'sign_in_required' };
  }

  const decision = judgeHelperRegistration({
    confirmedHelpers: facts.confirmedHelpers,
    grade: viewer.grade,
    helperCapacity: row.helperCapacity,
    helperMaxGrade: row.helperMaxGrade,
    helperMinGrade: row.helperMinGrade,
    helperRegistrationClosesAt: row.helperRegistrationClosesAt,
    helperRegistrationEnabled: row.helperRegistrationEnabled,
    helperRegistrationOpensAt: row.helperRegistrationOpensAt,
    helperRegistrationSeparateWindow: row.helperRegistrationSeparateWindow,
    maxGrade: row.maxGrade,
    minGrade: row.minGrade,
    now,
    pending: facts.pending,
    registered: facts.registered,
    registrationClosesAt: row.registrationClosesAt,
    registrationEnabled: row.registrationEnabled,
    registrationOpensAt: row.registrationOpensAt,
  });

  return decision.ok
    ? { eligible: true, reason: null }
    : { eligible: false, reason: decision.reason };
};

/**
 * An event as every endpoint answers it: the stored row plus its seat count and
 * the caller's eligibility, so a read and a write hand a client one shape.
 */
export const toEventItem = (
  row: typeof event.$inferSelect,
  seats: EventSeats,
  eligibility: EventEligibility
): EventItem => ({
  ...row,
  eligibility,
  seats,
});

/** The caller's own row on the event, as the rules need it. */
export type ViewerRegistrationState = {
  pending: boolean;
  registered: boolean;
};

/**
 * The item projection with the row's own counts, for one event. A caller that
 * already read the viewer's registration passes it in, so the detail read does
 * not fetch it twice.
 */
export const presentEvent = async (
  row: typeof event.$inferSelect,
  viewer: EventViewer,
  state?: ViewerRegistrationState
): Promise<EventItem> => {
  const [taken, registered] = await Promise.all([
    seatCount(row.id),
    state
      ? Promise.resolve(state.registered)
      : confirmedRegistration(row.id, viewer.userId ?? undefined).then(Boolean),
  ]);
  return toEventItem(
    row,
    toSeats(row.capacity, taken),
    eligibilityFor(row, viewer, {
      pending: state?.pending ?? false,
      registered,
      taken,
    })
  );
};
