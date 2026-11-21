import type { EventRegistrationItem } from '@filcdev/api/domains/events/registration';
import { and, eq, inArray } from 'drizzle-orm';
import type { db as Db } from '#database';
import { db } from '#database';
import {
  eventRegistration,
  eventRegistrationAnswer,
} from '#modules/events/schema';

type TxOrDb =
  | typeof db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

/** The caller's confirmed registration for one event, or null. */
export const confirmedRegistration = async (
  eventId: string,
  userId: string | undefined,
  tx?: TxOrDb
) => {
  if (!userId) {
    return null;
  }
  const [row] = await (tx ?? db)
    .select()
    .from(eventRegistration)
    .where(
      and(
        eq(eventRegistration.eventId, eventId),
        eq(eventRegistration.userId, userId),
        eq(eventRegistration.status, 'confirmed')
      )
    );
  return row ?? null;
};

/**
 * The caller's own registration on one event with its answers, cancelled ones
 * included: the detail view shows what they cancelled and offers to register
 * again.
 */
export const registrationWithAnswers = async (
  eventId: string,
  userId: string | undefined
): Promise<EventRegistrationItem | null> => {
  if (!userId) {
    return null;
  }
  const [row] = await db
    .select()
    .from(eventRegistration)
    .where(
      and(
        eq(eventRegistration.eventId, eventId),
        eq(eventRegistration.userId, userId)
      )
    );
  if (!row) {
    return null;
  }
  const answers = await db
    .select({
      fieldId: eventRegistrationAnswer.fieldId,
      value: eventRegistrationAnswer.value,
    })
    .from(eventRegistrationAnswer)
    .where(eq(eventRegistrationAnswer.registrationId, row.id));
  return { ...row, answers };
};

/** Which of these events the caller already holds a confirmed seat on. */
export const myConfirmedEventIds = async (
  userId: string | undefined,
  eventIds: readonly string[]
): Promise<Set<string>> => {
  if (!(userId && eventIds.length > 0)) {
    return new Set();
  }
  const rows = await db
    .select({ eventId: eventRegistration.eventId })
    .from(eventRegistration)
    .where(
      and(
        inArray(eventRegistration.eventId, [...eventIds]),
        eq(eventRegistration.userId, userId),
        eq(eventRegistration.status, 'confirmed')
      )
    );
  return new Set(rows.map((row) => row.eventId));
};
