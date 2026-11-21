import type {
  EventRegistrationDecideInput,
  EventRegistrationItem,
} from '@filcdev/api/domains/events/registration';
import { and, eq } from 'drizzle-orm';
import type { db as Db } from '#database';
import {
  event,
  eventField,
  eventRegistration,
  eventRegistrationAnswer,
} from '#modules/events/schema';
import {
  checkinGrantExpiresAt,
  revokeCheckinGrant,
  upsertCheckinGrant,
} from '#modules/events/utils/grant';
import {
  firstUnmetHelperRequirement,
  helperRequirementRefusalMessage,
} from '#modules/events/utils/helper-requirement-match';
import { badRequest, conflict, notFound } from '#utils/http';

export type DecideTransaction =
  | typeof Db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

/**
 * The organizer's answer to a pending registration, inside the caller's
 * transaction. Only a `pending` row may move: approving confirms it, declining
 * cancels it, and anything else is a 409 rather than a silent no-op, so a
 * double-click cannot flip an already-decided row.
 */
export const decidePendingRegistration = async (
  tx: DecideTransaction,
  input: EventRegistrationDecideInput
): Promise<EventRegistrationItem> => {
  const { decision, id: eventId, registrationId } = input;

  const [row] = await tx
    .select()
    .from(eventRegistration)
    .where(
      and(
        eq(eventRegistration.id, registrationId),
        eq(eventRegistration.eventId, eventId)
      )
    )
    .for('update');

  if (!row) {
    throw notFound('Registration not found');
  }
  if (row.status !== 'pending') {
    throw conflict('This registration is not waiting for approval');
  }

  const [eventRow] = await tx
    .select({
      endsAt: event.endsAt,
      helperRequirements: event.helperRequirements,
    })
    .from(event)
    .where(eq(event.id, eventId));
  if (!eventRow) {
    throw notFound('Event not found');
  }

  const [fields, answers] = await Promise.all([
    tx
      .select()
      .from(eventField)
      .where(eq(eventField.eventId, eventId))
      .orderBy(eventField.position),
    tx
      .select({
        fieldId: eventRegistrationAnswer.fieldId,
        value: eventRegistrationAnswer.value,
      })
      .from(eventRegistrationAnswer)
      .where(eq(eventRegistrationAnswer.registrationId, registrationId)),
  ]);

  // Approving re-checks the conditions against the answers as they stand now:
  // the organizer may have edited the requirements after the application
  // arrived. A decline never looks at them.
  if (decision === 'approve') {
    const failure = firstUnmetHelperRequirement(
      fields,
      eventRow.helperRequirements,
      answers
    );
    if (failure) {
      throw badRequest(helperRequirementRefusalMessage(failure.label));
    }
  }

  // The status predicate repeats on the write: the row lock already serializes
  // this, and the predicate keeps the update honest if that ever changes.
  const [updated] = await tx
    .update(eventRegistration)
    .set({ status: decision === 'approve' ? 'confirmed' : 'cancelled' })
    .where(
      and(
        eq(eventRegistration.id, registrationId),
        eq(eventRegistration.eventId, eventId),
        eq(eventRegistration.status, 'pending')
      )
    )
    .returning();

  if (!updated) {
    throw conflict('This registration is not waiting for approval');
  }

  // The door grant follows the decision inside the same transaction: an
  // approval opens the event until a day after it ends, and a decline closes
  // whatever an earlier approval had opened. A pending row is always a
  // signed-in helper, so it has a user to grant.
  if (updated.userId) {
    if (decision === 'approve') {
      await upsertCheckinGrant(tx, {
        eventId,
        expiresAt: checkinGrantExpiresAt(eventRow.endsAt),
        userId: updated.userId,
      });
    } else {
      await revokeCheckinGrant(tx, {
        eventId,
        userId: updated.userId,
      });
    }
  }

  return { ...updated, answers };
};
