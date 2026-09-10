import { and, desc, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '#database';
import { timetable } from '#database/schema/timetable';
import { dateToYYYYMMDD } from './date';

export async function getTimetableIdForDate(
  date: Date
): Promise<string | null> {
  const targetDate = dateToYYYYMMDD(date);

  const [active] = await db
    .select({ id: timetable.id })
    .from(timetable)
    .where(
      and(
        lte(timetable.validFrom, targetDate),
        or(isNull(timetable.validTo), gte(timetable.validTo, targetDate))
      )
    )
    .orderBy(desc(timetable.validFrom))
    .limit(1);

  return active?.id ?? null;
}

export function getActiveTimetableId(): Promise<string | null> {
  return getTimetableIdForDate(new Date());
}
