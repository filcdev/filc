import { env } from '@/utils/environment';
import { formatDateInTimeZone } from '@/utils/time-zone';

/**
 * A `Date` as `YYYY-MM-DD` in the configured school timezone
 * (`CHRONOS_TIME_ZONE`), not the host's.
 *
 * Used wherever a `date` column is compared against "today". The host's clock is
 * irrelevant: on a UTC server a UTC-formatted instant after local midnight names
 * the previous day, so the value would disagree with `/api/ping/time` and the
 * timetable's weekday lookup — both of which read the school timezone — and pick
 * the wrong active timetable around midnight.
 */
export const toDateOnlyString = (date: Date): string =>
  formatDateInTimeZone(date, env.timeZone);
