import type {
  EventRegistrationDecideInput,
  EventRegistrationItem,
} from '@filcdev/api/domains/events/registration';
import { and, eq } from 'drizzle-orm';
import type { db as Db } from '#database';
import {
  eventRegistration,
  eventRegistrationAnswer,
} from '#modules/events/schema';
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

  const answers = await tx
    .select({
      fieldId: eventRegistrationAnswer.fieldId,
      value: eventRegistrationAnswer.value,
    })
    .from(eventRegistrationAnswer)
    .where(eq(eventRegistrationAnswer.registrationId, registrationId));

  return { ...updated, answers };
};
