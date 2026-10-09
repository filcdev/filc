import type { ImportTimetableInput } from '@filcdev/api/domains/timetable/import';
import { permissions } from '@filcdev/api/permissions';
import {
  findTimetableImportAdapter,
  listTimetableImportAdapters,
  registerTimetableImportAdapter,
} from '@filcdev/timetable-import/adapters';
import { asc2012TimetableImportAdapter } from '@filcdev/timetable-import/asc2012';
import { importTimetable } from '@filcdev/timetable-import/import';
import { omanTimetableImportAdapter } from '@filcdev/timetable-import/oman';
import type { TimetableImportModel } from '@filcdev/timetable-import/types';
import { getLogger } from '@logtape/logtape';
import { ORPCError } from '@orpc/server';
import { timetableImportStore } from '#database/timetable-import-store';
import { requireAuthorization } from '#middleware/auth';
import { base } from '#orpc';
import { env } from '#utils/environment';
import { badRequest } from '#utils/http';

const logger = getLogger(['chronos', 'timetable']);

/** Reject uploads larger than this (kept under the body limit, generous for the ~750KB exports). */
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

// Register the built-in format adapters so uploads can be routed by content.
registerTimetableImportAdapter(omanTimetableImportAdapter);
registerTimetableImportAdapter(asc2012TimetableImportAdapter);

/**
 * Validate the upload, detect the format (MIME first, content as fallback), then
 * parse and persist it. Parse errors are client (400) faults; persistence
 * errors are server (500) faults.
 */
const runImport = async (body: ImportTimetableInput): Promise<void> => {
  const { file, name, validFrom, validTo } = body;

  if (file.size > MAX_IMPORT_BYTES) {
    // The pre-migration handler answered 413; the shared error map has no
    // request-too-long code, so the status stays explicit.
    throw new ORPCError('BAD_REQUEST', {
      message: 'The uploaded timetable file is too large.',
      status: 413,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Prefer MIME routing, but fall back to content detection. Browsers and
  // `curl -F` often send `application/octet-stream` for `.xml` files, which no
  // adapter claims by MIME type, yet the bytes are a valid aSc/Oman export.
  const adapter =
    findTimetableImportAdapter(bytes, file.type) ??
    listTimetableImportAdapters().find((candidate) =>
      candidate.detect?.(bytes)
    );
  if (!adapter) {
    throw badRequest('Unsupported file type');
  }

  let model: TimetableImportModel;
  try {
    model = adapter.parse(bytes, logger);
  } catch (e) {
    logger.error('Failed to parse XML', { error: e });
    throw badRequest(
      'Failed to parse XML',
      env.mode === 'development' ? e : undefined
    );
  }

  try {
    logger.info('Starting timetable import');
    const start = performance.now();

    await importTimetable(
      model,
      {
        name,
        validFrom,
        validTo: validTo ?? null,
      },
      timetableImportStore,
      logger
    );

    logger.info('Imported timetable', {
      durationMs: performance.now() - start,
    });
  } catch (e) {
    logger.error('Failed to import timetable', { error: e });
    throw new ORPCError('INTERNAL', {
      cause: env.mode === 'development' ? e : undefined,
      message: 'Failed to import timetable',
    });
  }
};

export const importRoute = base.timetable.import
  // Authorize before the upload is parsed and persisted: an unauthenticated
  // caller must not be able to trigger the import work.
  .use(requireAuthorization(permissions.importTimetable))
  .handler(async ({ input }) => {
    await runImport(input);

    return { ok: true } as const;
  });
