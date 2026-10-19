import type { Dayjs } from 'dayjs';
import { dayjs } from '@/utils/dayjs';

/** The fields of a period the ticker filters on. */
export type PeriodTime = { endTime: string };

/** A lesson whose period has ended is in the past and must not be shown.
 *  `endTime` is the timetable's own clock string (`HH:mm:ss`), so the ticker
 *  follows the periods the timetable defines instead of a hardcoded bell
 *  schedule. `now` is required so callers compare against a real ticking clock
 *  rather than a fresh `dayjs()` that can never change between renders. */
export function isPeriodOver(period: PeriodTime, now: Dayjs): boolean {
  return now.isAfter(dayjs(period.endTime, 'HH:mm:ss'));
}
