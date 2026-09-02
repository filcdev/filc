import type { TimetableImportLogger, TimetableImportModel } from '../types';

/**
 * A timetable import format adapter.
 *
 * An adapter turns raw bytes in a specific format (Oman XML, aSc 2012 XML,
 * CSV, JSON or another vendor format later) into the format-agnostic
 * {@link TimetableImportModel}. Register an instance to make a format
 * available to the importer.
 */
export type TimetableImportAdapter = {
  /** Unique format identifier, e.g. `'oman'`. */
  format: string;
  /** MIME types the adapter can parse (used to route uploads). */
  mimeTypes: string[];
  /**
   * Content-based format discriminator. When several adapters accept the same
   * MIME type the routing helper prefers the one whose `detect` matches.
   */
  detect?(input: Uint8Array): boolean;
  /**
   * Parses raw uploaded bytes into a normalized timetable model. An optional
   * logger lets the adapter report diagnostics (e.g. skipped cards).
   */
  parse(
    input: Uint8Array,
    logger?: TimetableImportLogger
  ): TimetableImportModel;
};

const registry = new Map<string, TimetableImportAdapter>();

export const registerTimetableImportAdapter = (
  adapter: TimetableImportAdapter
): void => {
  registry.set(adapter.format, adapter);
};

export const getTimetableImportAdapter = (
  format: string
): TimetableImportAdapter | undefined => registry.get(format);

export const listTimetableImportAdapters = (): TimetableImportAdapter[] => [
  ...registry.values(),
];

export const findTimetableImportAdapterForMimeType = (
  mimeType: string
): TimetableImportAdapter | undefined =>
  [...registry.values()].find((adapter) =>
    adapter.mimeTypes.includes(mimeType)
  );

/**
 * Pick the adapter for an uploaded file. Filters by MIME type, then prefers the
 * adapter whose {@link TimetableImportAdapter.detect} matches the content (so
 * formats that share a MIME type, like Oman XML and aSc 2012 XML, route
 * correctly). Falls back to the first MIME-type match.
 */
export const findTimetableImportAdapter = (
  input: Uint8Array,
  mimeType: string
): TimetableImportAdapter | undefined => {
  const byMime = [...registry.values()].filter((adapter) =>
    adapter.mimeTypes.includes(mimeType)
  );
  return byMime.find((adapter) => adapter.detect?.(input)) ?? byMime[0];
};
