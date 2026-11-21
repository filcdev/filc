/**
 * The fixed CSV columns of an event's participant export, in order. The keys are
 * the CSV header cells, exactly like the timetable exports; the client localizes
 * the header labels it writes into the spreadsheet.
 */
export const EVENT_EXPORT_COLUMNS = [
  'name',
  'email',
  'class',
  'role',
  'status',
  'registered_at',
  'checked_in_at',
] as const;

export type EventExportColumn = (typeof EVENT_EXPORT_COLUMNS)[number];

/**
 * The header cells of the custom-question columns, one per question in the
 * order given (the event's position order).
 *
 * The label is the cell, because that is what a human opening the CSV expects.
 * Two questions may share a label — nothing stops an organizer from adding the
 * same one twice — so a repeat gets ` (2)`, ` (3)`, … and the cells stay unique.
 * A question labelled exactly like a fixed column (`name`, `email`, …) would
 * overwrite that fixed cell, since rows are keyed by header, so it gets a
 * ` (question)` suffix instead.
 * The export handler and the client both call this, over the same ordered
 * question list, so the client's column keys match the file it parses.
 */
export function eventQuestionColumnHeaders(
  fields: readonly { label: string }[]
): string[] {
  const used = new Set<string>(EVENT_EXPORT_COLUMNS);
  const seen = new Map<string, number>();
  return fields.map((field) => {
    const times = (seen.get(field.label) ?? 0) + 1;
    seen.set(field.label, times);
    let header = times === 1 ? field.label : `${field.label} (${times})`;
    while (used.has(header)) {
      header = `${header} (question)`;
    }
    used.add(header);
    return header;
  });
}
