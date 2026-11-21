import type {
  EventRegistrationDecideInput,
  EventRegistrationItem,
} from '@filcdev/api/domains/events/registration';
import { and, count, eq } from 'drizzle-orm';
import type { db as Db } from '#database';
import {
  event,
  eventRegistration,
  eventRegistrationAnswer,
} from '#modules/events/schema';
import {
  checkinGrantExpiresAt,
  revokeCheckinGrant,
  upsertCheckinGrant,
} from '#modules/events/utils/grant';
import { conflict, notFound } from '#utils/http';

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

  const [[eventRow], answers, confirmedHelpers] = await Promise.all([
    tx
      .select({ endsAt: event.endsAt, helperCapacity: event.helperCapacity })
      .from(event)
      .where(eq(event.id, eventId))
      .for('update'),
    tx
      .select({
        fieldId: eventRegistrationAnswer.fieldId,
        value: eventRegistrationAnswer.value,
      })
      .from(eventRegistrationAnswer)
      .where(eq(eventRegistrationAnswer.registrationId, registrationId)),
    tx
      .select({ value: count() })
      .from(eventRegistration)
      .where(
        and(
          eq(eventRegistration.eventId, eventId),
          eq(eventRegistration.role, 'helper'),
          eq(eventRegistration.status, 'confirmed')
        )
      ),
  ]);
  if (!eventRow) {
    throw notFound('Event not found');
  }

  // Only a helper consumes the helper cap; a pending participant is confirmed
  // against the seat rule the create path already applied.
  if (
    decision === 'approve' &&
    row.role === 'helper' &&
    eventRow.helperCapacity != null &&
    Number(confirmedHelpers[0]?.value ?? 0) >= eventRow.helperCapacity
  ) {
    throw conflict('The helper limit has been reached');
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

  // Only a helper signup is pending, and a helper never takes a room, so the
  // decided row has no room to name.
  return { ...updated, answers, room: null };
};
