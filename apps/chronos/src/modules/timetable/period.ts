import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '#database';
import { lesson, period } from '#modules/timetable/schema';
import { base } from '#orpc';

export const getPeriodsForTimetable = base.timetable.periods.getAll.handler(
  async ({ input }) => {
    const { timetableId } = input;

    let periods: (typeof period.$inferSelect)[];

    if (timetableId) {
      // Get all distinct period IDs used in lessons for this timetable
      const usedPeriodIds = await db
        .selectDistinct({ periodId: lesson.periodId })
        .from(lesson)
        .where(eq(lesson.timetableId, timetableId));

      const ids = usedPeriodIds.map((r) => r.periodId);

      if (ids.length === 0) {
        return [];
      }

      periods = await db
        .select()
        .from(period)
        .where(inArray(period.id, ids))
        .orderBy(asc(period.period));
    } else {
      periods = await db.select().from(period).orderBy(asc(period.period));
    }

    const data = periods.map((p) => ({
      endTime: String(p.endTime),
      id: p.id,
      period: p.period,
      startTime: String(p.startTime),
    }));

    return data;
  }
);
