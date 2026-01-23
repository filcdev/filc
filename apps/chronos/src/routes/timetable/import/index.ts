import { getLogger } from '@logtape/logtape';
import { XMLParser } from 'fast-xml-parser';
import { HTTPException } from 'hono/http-exception';
import { describeRoute, resolver } from 'hono-openapi';
import { StatusCodes } from 'http-status-codes';
import { decode } from 'iconv-lite';
import z from 'zod';
import type { SuccessResponse } from '#_types/globals';
import { requireAuthentication, requireAuthorization } from '#middleware/auth';
import { timetableFactory } from '#routes/timetable/_factory';
import { env } from '#utils/environment';
import { importTimetableXML } from '#utils/timetable/imports';
import { timetableExportRootSchema } from '#utils/timetable/schemas';
import { ensureJsonSafeDates } from '#utils/zod';

const logger = getLogger(['chronos', 'timetable']);

const importResponseSchema = z.object({
  success: z.literal(true),
});

const importSchema = (
  await resolver(
    ensureJsonSafeDates(
      z.object({
        name: z.string(),
        omanXml: z.file(),
        validFrom: z.date(),
      })
    )
  ).toOpenAPISchema()
).schema;

export const importRoute = timetableFactory.createHandlers(
  describeRoute({
    description: 'Import a timetable from an Oman XML file.',
    requestBody: {
      content: {
        'multipart/form-data': {
          schema: importSchema,
        },
      },
      description: 'The data for the new timetable.',
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(ensureJsonSafeDates(importResponseSchema)),
          },
        },
        description: 'Successful Response',
      },
    },
    tags: ['Timetable', 'Import'],
  }),
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    const body = (await c.req.parseBody()) as {
      omanXml?: File;
      name?: string;
      validFrom?: string;
    };

    // get file
    const file = body.omanXml as File;
    const name = body.name;
    const validFromString = body.validFrom;
    const validFrom = validFromString ? new Date(validFromString) : undefined;

    if (!file) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'No file provided',
      });
    }

    if (!name) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'No name provided',
      });
    }

    if (!validFrom) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'No validFrom provided',
      });
    }

    // check that we got valid XML
    if (file.type !== 'text/xml' && file.type !== 'application/xml') {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Invalid file type, must be XML',
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const decoded = decode(buffer, 'win1250');
    const cleaned = decoded.replaceAll('Period=""', '');

    const parser = new XMLParser({
      attributeNamePrefix: '_',
      ignoreAttributes: false,
      parseAttributeValue: false,
      parseTagValue: true,
      textNodeName: 'text',
      trimValues: true,
    });

    try {
      logger.info('Starting timetable import');
      const start = performance.now();
      const input = parser.parse(cleaned);
      const data = z.parse(timetableExportRootSchema, input);

      await importTimetableXML(data, {
        name,
        validFrom: validFrom.toISOString(),
      });
      const end = performance.now();

      logger.info('Imported timetable', {
        durationMs: end - start,
      });

      return c.json<SuccessResponse>({
        success: true,
      });
    } catch (e) {
      logger.error('Failed to parse XML', { error: e });
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        cause: env.mode === 'development' ? e : undefined,
        message: 'Failed to parse XML',
      });
    }
  }
);
