import { and, count, desc, gte, isNotNull, lte } from 'drizzle-orm';
import { db } from '#database';
import { user } from '#database/schema/authentication';
import { role } from '#database/schema/authorization';
import { cohort, movedLesson, substitution } from '#modules/timetable/schema';
import { getActiveTimetableId } from '#modules/timetable/utils/active';
import { base } from '#orpc';

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const getDashboardStats = base.dashboard.stats.handler(
  async ({ input }) => {
    const { days } = input;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - days + 1);

    const [[usersRow], [cohortsRow], [rolesRow], relevantSubs, timetableId] =
      await Promise.all([
        db.select({ count: count() }).from(user),
        db.select({ count: count() }).from(cohort),
        db.select({ count: count() }).from(role),
        db
          .select({ date: substitution.date })
          .from(substitution)
          .where(
            and(
              gte(substitution.date, fromDate),
              lte(substitution.date, today),
              isNotNull(substitution.substituter)
            )
          )
          .orderBy(desc(substitution.date)),
        getActiveTimetableId(),
      ]);

    // Live counts: today + upcoming only, not affected by the days filter
    const [[liveSubsRow], [liveMovedRow]] = await Promise.all([
      db
        .select({ count: count() })
        .from(substitution)
        .where(
          and(
            gte(substitution.date, today),
            isNotNull(substitution.substituter)
          )
        ),
      timetableId
        ? db
            .select({ count: count() })
            .from(movedLesson)
            .where(gte(movedLesson.date, today))
        : Promise.resolve([{ count: 0 }]),
    ]);

    let movedLessonDates: { date: Date }[] = [];
    if (timetableId) {
      movedLessonDates = await db
        .select({ date: movedLesson.date })
        .from(movedLesson)
        .where(
          and(gte(movedLesson.date, fromDate), lte(movedLesson.date, today))
        );
    }

    const dateMap = new Map<
      string,
      { movedLessons: number; substitutions: number }
    >();

    for (const sub of relevantSubs) {
      const d = fmtDate(sub.date);
      const entry = dateMap.get(d) ?? { movedLessons: 0, substitutions: 0 };
      entry.substitutions += 1;
      dateMap.set(d, entry);
    }

    for (const m of movedLessonDates) {
      const d = fmtDate(m.date);
      const entry = dateMap.get(d) ?? { movedLessons: 0, substitutions: 0 };
      entry.movedLessons += 1;
      dateMap.set(d, entry);
    }

    const chartData = [...dateMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    return {
      stats: {
        chartData,
        chartTotalMovedLessons: movedLessonDates.length,
        chartTotalSubstitutions: relevantSubs.length,
        totalCohorts: cohortsRow?.count ?? 0,
        totalMovedLessons: liveMovedRow?.count ?? 0,
        totalRoles: rolesRow?.count ?? 0,
        totalSubstitutions: liveSubsRow?.count ?? 0,
        totalUsers: usersRow?.count ?? 0,
      },
    };
  }
);
