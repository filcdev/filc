import { eq } from 'drizzle-orm';
import { db } from '#database';
import { teacher } from '#modules/timetable/schema';
import type { ChannelDefaults } from '#utils/notifications/types';

/**
 * Whether the user is linked to a teacher row: the `EXISTS` lookup that makes
 * a teacher's channel defaults differ from everyone else's.
 */
export async function isTeacherUser(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: teacher.id })
    .from(teacher)
    .where(eq(teacher.userId, userId))
    .limit(1);
  return row !== undefined;
}

/**
 * The fallbacks a user gets when their stored preferences do not name a
 * channel. Teachers keep email on; everyone else starts with email off and
 * in-app/push on.
 */
export async function channelDefaultsForUser(
  userId: string
): Promise<ChannelDefaults> {
  return { email: await isTeacherUser(userId) };
}
