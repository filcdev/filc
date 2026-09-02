import {
  importResponseSchema,
  importSchema,
} from '@filcdev/api/domains/timetable/import';
import {
  findTimetableImportAdapterForMimeType,
  registerTimetableImportAdapter,
} from '@filcdev/timetable-import/adapters';
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

// Register the built-in format adapters so uploads can be routed by MIME type.
registerTimetableImportAdapter(omanTimetableImportAdapter);

export const importRoute = timetableFactory.createHandlers(
  describeRoute({
    description: 'Import a timetable from an Oman XML file.',
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
    const file = body.omanXml;
    const name = body.name;
    const validFrom = body.validFrom;
    const validTo = body.validTo;

    const adapter = findTimetableImportAdapterForMimeType(file.type);
    if (!adapter) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Invalid file type, must be XML',
      });
    }

    try {
      logger.info('Starting timetable import');
      const start = performance.now();
      const model = adapter.parse(new Uint8Array(await file.arrayBuffer()));

      await importTimetable(
        model,
        {
          name,
          validFrom: validFrom.toISOString(),
          validTo: validTo?.toISOString() ?? null,
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
