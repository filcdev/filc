/** A field needs quoting when it could otherwise break the row or record. */
const CSV_SPECIAL_CHARS = /[",\n\r]/;
const CSV_QUOTE = /"/g;

/** One CSV cell, RFC 4180 style: quoted when it has to be, `""` for a quote. */
export const escapeCsvField = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (CSV_SPECIAL_CHARS.test(str)) {
    return `"${str.replace(CSV_QUOTE, '""')}"`;
  }
  return str;
};

/**
 * A CSV document: the header row, then one row per record, cells looked up by
 * the header names. Comma-separated and UTF-8, the shape every export in this
 * API has. The byte-order mark lives in `csvFile`, not here: this is the text,
 * the BOM is how the file is encoded.
 */
export const toCsv = (
  header: readonly string[],
  rows: readonly Record<string, unknown>[]
): string => {
  const lines = rows.map((row) =>
    header.map((col) => escapeCsvField(row[col])).join(',')
  );
  return [header.join(','), ...lines].join('\n');
};

export const csvFilename = (prefix: string): string =>
  `${prefix}-export-${new Date().toISOString().slice(0, 10)}.csv`;

/**
 * Windows Excel decodes a `.csv` in the ANSI code page unless the file starts
 * with a UTF-8 BOM, mangling every Hungarian name and accented answer. The BOM
 * is a byte-level marker in front of the text, so it is added to the file's
 * bytes here for every export that shares `csvFile`.
 */
const UTF8_BOM = '\uFEFF';

/** The `File` a file-typed route answers with. */
export const csvFile = (
  prefix: string,
  header: readonly string[],
  rows: readonly Record<string, unknown>[]
): File =>
  new File([UTF8_BOM, toCsv(header, rows)], csvFilename(prefix), {
    type: 'text/csv; charset=utf-8',
  });
