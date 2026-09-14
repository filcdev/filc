import { dayjs } from '@/utils/dayjs';

/** The fields of a period the ticker filters on. */
export type PeriodTime = { endTime: string };

/** A lesson whose period has ended is in the past and must not be shown.
 *  `endTime` is the timetable's own clock string (`HH:mm:ss`), so the ticker
 *  follows the periods the timetable defines instead of a hardcoded bell
 *  schedule. */
export function isPeriodOver(period: PeriodTime): boolean {
  return dayjs().isAfter(dayjs(period.endTime, 'HH:mm:ss'));
}
