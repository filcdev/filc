/**
 * A `Date` as `YYYY-MM-DD` in the server's local timezone.
 *
 * Used wherever a `date` column is compared against "today": the value must be
 * built from local components, because a UTC-formatted date would name the
 * previous day for every hour after local midnight in a positive-offset zone.
 */
export const toDateOnlyString = (date: Date): string =>
  date.toLocaleDateString('en-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
