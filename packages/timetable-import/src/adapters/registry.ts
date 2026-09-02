import type { TimetableImportModel } from '../types';

/**
 * A timetable import format adapter.
 *
 * An adapter turns raw bytes in a specific format (Oman XML today; CSV, JSON
 * or another vendor format later) into the format-agnostic
 * {@link TimetableImportModel}. Register an instance to make a format
 * available to the importer.
 */
export type TimetableImportAdapter = {
  /** Unique format identifier, e.g. `'oman'`. */
  format: string;
  /** MIME types the adapter can parse (used to route uploads). */
  mimeTypes: string[];
  /** Parses raw uploaded bytes into a normalized timetable model. */
  parse(input: Uint8Array): TimetableImportModel;
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
