/** "P3 10:00–10:45" from a lesson period. */
export function formatPeriodLabel(p: {
  startTime?: string | null;
  endTime?: string | null;
  period?: number | null;
}): string {
  return `P${p.period ?? ''} ${(p.startTime ?? '').slice(0, 5)}\u2013${(p.endTime ?? '').slice(0, 5)}`;
}
