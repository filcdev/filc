import type { EventRegistrationAnswer } from '@filcdev/api/domains/events/registration';
import { eq } from 'drizzle-orm';
import type { db as Db, db } from '#database';
import { event, eventRegistrationAnswer } from '#modules/events/schema';
import { conflict, notFound } from '#utils/http';
import { isForeignKeyViolation } from '#utils/postgres';

/** The message a form race answers with; the cause stays the driver error. */
const FORM_RACE_MESSAGE =
  'The signup form changed while you were filling it in; try again';

/**
 * Run a registration write and turn a foreign-key violation into a conflict.
 *
 * Both write paths lock the event before reading its questions, so a question
 * cannot normally vanish mid-request. This is the backstop for the case that
 * slips through: the answer insert names a question the driver no longer has,
 * and a 500 would be the wrong answer for a retryable conflict.
 */
export const runWithFormRaceGuard = async <T>(
  run: () => Promise<T>
): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflict(FORM_RACE_MESSAGE, error);
    }
    throw error;
  }
};

export type TxOrDb =
  | typeof db
  | Parameters<Parameters<(typeof Db)['transaction']>[0]>[0];

/**
 * The event row, locked, and only when it is published.
 *
 * Both registration paths judge capacity against a count another request can
 * change between the read and the insert, so `FOR UPDATE` serializes them: two
 * requests for the last seat cannot both see it free. A draft or archived event
 * answers 404, because saying "not open" would admit it exists.
 */
export const lockPublishedEvent = async (tx: TxOrDb, eventId: string) => {
  const [row] = await tx
    .select()
    .from(event)
    .where(eq(event.id, eventId))
    .for('update');

  if (!(row && row.status === 'published')) {
    throw notFound('Event not found');
  }
  return row;
};

/** This registration's answers are the form's current ones, so the old set goes. */
export const replaceAnswers = async (
  tx: TxOrDb,
  registrationId: string,
  answers: readonly EventRegistrationAnswer[]
): Promise<void> => {
  await tx
    .delete(eventRegistrationAnswer)
    .where(eq(eventRegistrationAnswer.registrationId, registrationId));
  if (answers.length > 0) {
    await tx.insert(eventRegistrationAnswer).values(
      answers.map((answer) => ({
        fieldId: answer.fieldId,
        registrationId,
        value: answer.value,
      }))
    );
  }
};
