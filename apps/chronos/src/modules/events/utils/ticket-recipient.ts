import { getLogger } from '@logtape/logtape';
import { eq } from 'drizzle-orm';
import { user } from '#database/schema/authentication';
import { eventRegistration } from '#modules/events/schema';
import type { TxOrDb } from '#modules/events/utils/registration-write';
import { userPreferences } from '#modules/notifications/schema';
import { mailLocale } from '#utils/notifications/locale';

const logger = getLogger(['chronos', 'events', 'tickets']);

/** Where one registration's ticket goes, and in what language. */
export type TicketRecipient = {
  email: string;
  locale: string;
  name: string;
};

/**
 * The address, name and language a registration's ticket is mailed to.
 *
 * A guest carries their own address and name on the registration and has no
 * preferences, so they get the school's default language. A signed-in student
 * or helper has no guest columns; their account supplies the address and name,
 * and their stored preference supplies the language. An absent or blank address
 * is not a recipient, and the caller answers as if there were no ticket.
 */
export const resolveTicketRecipient = async (
  tx: TxOrDb,
  registrationId: string,
  requestId?: string
): Promise<TicketRecipient | null> => {
  const [row] = await tx
    .select({
      guestEmail: eventRegistration.guestEmail,
      guestName: eventRegistration.guestName,
      language: userPreferences.language,
      userEmail: user.email,
      userName: user.name,
    })
    .from(eventRegistration)
    .leftJoin(user, eq(eventRegistration.userId, user.id))
    .leftJoin(userPreferences, eq(userPreferences.userId, user.id))
    .where(eq(eventRegistration.id, registrationId));

  if (!row) {
    logger.debug('ticket recipient registration not found', {
      registrationId,
      requestId,
    });
    return null;
  }

  const email = (row.guestEmail ?? row.userEmail ?? '').trim();
  if (!email) {
    logger.debug('registration has no usable address for a ticket', {
      registrationId,
      requestId,
    });
    return null;
  }

  // A guest wrote no locale; a signed-in recipient's stored language decides,
  // with the mail locale helper falling back to Hungarian.
  const isGuest = Boolean(row.guestEmail);
  return {
    email,
    locale: isGuest ? 'hu' : mailLocale(row.language),
    name: row.guestName ?? row.userName ?? '',
  };
};
