import { eq } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';

/** Anything with the `select` of a database client, including a transaction. */
type EmailExecutor = Pick<typeof db, 'select'>;

/**
 * The user's email, lowercased, or `null` when the account does not exist.
 *
 * Used when a teacher row is linked to a user so the link can seed
 * `teacher.email` without overwriting an address an admin set by hand. The
 * optional executor lets the import transaction run the lookup on its own
 * connection.
 */
export async function getUserEmail(
  userId: string,
  executor: EmailExecutor = db
): Promise<string | null> {
  const [row] = await executor
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return row?.email?.toLowerCase() ?? null;
}
