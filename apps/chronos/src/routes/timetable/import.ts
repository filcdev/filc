import {
  importResponseSchema,
  importSchema,
} from '@filcdev/api/domains/timetable/import';
import {
  findTimetableImportAdapter,
  registerTimetableImportAdapter,
} from '@filcdev/timetable-import/adapters';
import { asc2012TimetableImportAdapter } from '@filcdev/timetable-import/asc2012';
import { importTimetable } from '@filcdev/timetable-import/import';
import { omanTimetableImportAdapter } from '@filcdev/timetable-import/oman';
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

// Register the built-in format adapters so uploads can be routed by content.
registerTimetableImportAdapter(omanTimetableImportAdapter);
registerTimetableImportAdapter(asc2012TimetableImportAdapter);

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
  zValidator('form', importSchema),
  ...authRouter('import:timetable'),
  async (c) => {
    const body = c.req.valid('form');

    // get file
    const file = body.file;
    const name = body.name;
    const validFrom = body.validFrom;
    const validTo = body.validTo;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const adapter = findTimetableImportAdapter(bytes, file.type);
    if (!adapter) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Unsupported file type',
      });
    }

    try {
      logger.info('Starting timetable import');
      const start = performance.now();
      const model = adapter.parse(bytes);

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
      const end = performance.now();

      logger.info('Imported timetable', {
        durationMs: end - start,
      });

      return ok(c, undefined);
    } catch (e) {
      logger.error('Failed to parse XML', { error: e });
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        cause: env.mode === 'development' ? e : undefined,
        message: 'Failed to parse XML',
      });
    }
  }
);
