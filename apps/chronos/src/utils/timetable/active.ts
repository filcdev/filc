import { and, desc, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '#database';
import { timetable } from '#database/schema/timetable';
import { dateToYYYYMMDD } from './date';

export async function getActiveTimetableId(): Promise<string | null> {
  const today = dateToYYYYMMDD(new Date());
  const [active] = await db
    .select({ id: timetable.id })
    .from(timetable)
    .where(
      and(
        lte(timetable.validFrom, today),
        or(isNull(timetable.validTo), gte(timetable.validTo, today))
      )
    )
    .orderBy(desc(timetable.validFrom))
    .limit(1);
  return active?.id ?? null;
}
