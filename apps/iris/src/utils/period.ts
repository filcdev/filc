/** `"12:50 – 13:35, 6. Óra"` — a period's time range plus its ordinal number
 * and the localized word for "period". */
export function formatPeriodLabel(
  p: {
    startTime?: string | null;
    endTime?: string | null;
    period?: number | null;
  },
  periodWord: string
): string {
  const time =
    p.startTime && p.endTime
      ? `${p.startTime.slice(0, 5)} \u2013 ${p.endTime.slice(0, 5)}`
      : '';
  const number = p.period == null ? '' : `${p.period}. ${periodWord}`;
  return [time, number].filter(Boolean).join(', ');
}
