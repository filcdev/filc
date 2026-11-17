import { eq } from 'drizzle-orm';
import { db } from '#database';
import { substitution, substitutionLessonMTM } from '#modules/timetable/schema';
import {
  loadSubstitutionTeacherPayload,
  type SubstitutionTeacherPayload,
} from '#utils/notifications/substitution-teacher';

/** The payload both timetable substitution handlers consume. */
export type SubstitutionNotificationPayload = SubstitutionTeacherPayload & {
  lessonIds: string[];
};

/**
 * Load one substitution with its linked lesson ids and the enriched teacher
 * payload, shaped for the notification builders. Returns null when the row is
 * gone.
 */
export async function loadSubstitutionNotificationPayload(
  substitutionId: string
): Promise<SubstitutionNotificationPayload | null> {
  const [row] = await db
    .select()
    .from(substitution)
    .where(eq(substitution.id, substitutionId))
    .limit(1);

  if (!row) {
    return null;
  }

  const links = await db
    .select({ lessonId: substitutionLessonMTM.lessonId })
    .from(substitutionLessonMTM)
    .where(eq(substitutionLessonMTM.substitutionId, substitutionId));
  const lessonIds = links.map((link) => link.lessonId);

  return {
    ...(await loadSubstitutionTeacherPayload({
      comment: row.comment,
      date: row.date,
      lessonIds,
      substituter: row.substituter,
    })),
    lessonIds,
  };
}
