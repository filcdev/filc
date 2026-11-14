import { inArray } from 'drizzle-orm';
import { db } from '#database';
import { user as userTable } from '#database/schema/authentication';
import { userPreferences } from '#modules/notifications/schema';
import { teacher } from '#modules/timetable/schema';
import type { AudienceUser } from './types';

/**
 * The user accounts behind a set of `teacher` rows, with the language each
 * recipient reads their mail in.
 *
 * A `teacher` row is the only link between a lesson and a user account, so a
 * teacher without a `userId` has nobody to notify and is dropped. Every
 * teacher-addressed notification resolves its audience here, so the
 * substitution and moved-lesson mails cannot drift apart.
 */
export async function resolveTeacherUserAudience(
  teacherIds: string[]
): Promise<AudienceUser[]> {
  const ids = [...new Set(teacherIds)];
  if (ids.length === 0) {
    return [];
  }

  const teacherRows = await db
    .select({ userId: teacher.userId })
    .from(teacher)
    .where(inArray(teacher.id, ids));

  const userIds = [
    ...new Set(
      teacherRows
        .map((row) => row.userId)
        .filter((id): id is string => id !== null)
    ),
  ];

  if (userIds.length === 0) {
    return [];
  }

  const [users, prefs] = await Promise.all([
    db
      .select({
        cohortId: userTable.cohortId,
        email: userTable.email,
        id: userTable.id,
        name: userTable.name,
      })
      .from(userTable)
      .where(inArray(userTable.id, userIds)),
    db
      .select({
        language: userPreferences.language,
        userId: userPreferences.userId,
      })
      .from(userPreferences)
      .where(inArray(userPreferences.userId, userIds)),
  ]);

  const languageMap = new Map(prefs.map((p) => [p.userId, p.language]));

  return users.map((user) => ({
    cohortId: user.cohortId,
    email: user.email,
    id: user.id,
    language: languageMap.get(user.id) ?? 'hu',
    name: user.name,
  }));
}
