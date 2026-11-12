import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';
import { db } from '#database';
import { teacher } from '#modules/timetable/schema';
import type { ChannelDefaults } from '#utils/notifications/types';

/**
 * The one definition of "this account is linked to a teacher row":
 * `teacher.user_id = <userId>`. `userId` is either a bound value or a column of
 * the query embedding the predicate, which is what lets the engine ask the
 * question inside its per-recipient select.
 */
function teacherLink(userId: string | SQLWrapper): SQL {
  return sql`${teacher.userId} = ${userId}`;
}

/**
 * `EXISTS (select 1 from teacher where teacher.user_id = <userId>)`: the
 * teacher-existence predicate as a selectable fragment. The notification engine
 * puts it beside the recipient's preferences so a role-aware default still
 * costs one query per recipient instead of two.
 */
export function linkedTeacherExists(userId: string | SQLWrapper): SQL<boolean> {
  return sql<boolean>`exists (select 1 from ${teacher} where ${teacherLink(userId)})`;
}

/**
 * Whether the user is linked to a teacher row, from the shared predicate: the
 * answer that makes a teacher's channel defaults differ from everyone else's.
 */
export async function isTeacherUser(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: teacher.id })
    .from(teacher)
    .where(teacherLink(userId))
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
