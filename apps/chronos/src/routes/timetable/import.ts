import type { ImportTimetableInput } from '@filcdev/api/domains/timetable/import';
import {
  importResponseSchema,
  importSchema,
} from '@filcdev/api/domains/timetable/import';
import {
  findTimetableImportAdapter,
  listTimetableImportAdapters,
  registerTimetableImportAdapter,
} from '@filcdev/timetable-import/adapters';
import { asc2012TimetableImportAdapter } from '@filcdev/timetable-import/asc2012';
import { importTimetable } from '@filcdev/timetable-import/import';
import { omanTimetableImportAdapter } from '@filcdev/timetable-import/oman';
import type { TimetableImportModel } from '@filcdev/timetable-import/types';
import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import { timetableImportStore } from '#database/timetable-import-store';
import { authRouter } from '#middleware/auth';
import { timetableFactory } from '#routes/timetable/_factory';
import { env } from '#utils/environment';
import { ok } from '#utils/http';

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
    throw new HTTPException(StatusCodes.REQUEST_TOO_LONG, {
      message: 'The uploaded timetable file is too large.',
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
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      message: 'Unsupported file type',
    });
  }

  let model: TimetableImportModel;
  try {
    model = adapter.parse(bytes, logger);
  } catch (e) {
    logger.error('Failed to parse XML', { error: e });
    throw new HTTPException(StatusCodes.BAD_REQUEST, {
      cause: env.mode === 'development' ? e : undefined,
      message: 'Failed to parse XML',
    });
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
    throw new HTTPException(StatusCodes.INTERNAL_SERVER_ERROR, {
      cause: env.mode === 'development' ? e : undefined,
      message: 'Failed to import timetable',
    });
  }
};

export const importRoute = timetableFactory.createHandlers(
  describeRoute({
    description: 'Import a timetable from an Oman or aSc 2012 XML file.',
    requestBody: {
      content: {
        'multipart/form-data': {
          schema: (await resolver(importSchema).toOpenAPISchema()).schema,
        },
      },
      description: 'The data for the new timetable.',
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(importResponseSchema),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable', 'Import'],
  }),
  // Authenticate before the form validator so unauthenticated requests cannot
  // force the whole uploaded file into memory (z.file() is unbounded).
  ...authRouter('import:timetable'),
  zValidator('form', importSchema),
  async (c) => {
    await runImport(c.req.valid('form'));
    return ok(c, undefined);
  }
);
