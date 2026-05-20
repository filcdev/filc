import { zValidator } from '@hono/zod-validator';
import { getLogger } from '@logtape/logtape';
import dayjs from 'dayjs';
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
import { getActiveTimetableId } from '#utils/timetable/active';
import { importTimetableXML } from '#utils/timetable/imports';
import { timetableExportRootSchema } from '#utils/timetable/schemas';

const logger = getLogger(['chronos', 'timetable']);

const importResponseSchema = z.object({
  success: z.literal(true),
});

const importSchema = z.object({
  name: z.string(),
  omanXml: z.file(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
});

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
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    // const body = (await c.req.parseBody()) as {
    //   omanXml?: File;
    //   name?: string;
    //   validFrom?: string;
    // };
    const body = c.req.valid('form');

    // get file
    const file = body.omanXml;
    const name = body.name;
    const validFrom = body.validFrom;
    const validTo = body.validTo;

    // check that we got valid XML
    if (file.type !== 'text/xml' && file.type !== 'application/xml') {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Invalid file type, must be XML',
      });
    }

    // Compute auto-expire params for the currently active timetable (if any).
    // The actual DB update happens inside importTimetableXML's transaction so
    // it is rolled back atomically if the import fails.
    const activeId = await getActiveTimetableId();
    const autoExpire =
      activeId && validFrom
        ? {
            id: activeId,
            validTo: dayjs(validFrom).subtract(1, 'day').format('YYYY-MM-DD'),
          }
        : undefined;

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
        autoExpire,
        name,
        validFrom: validFrom.toISOString(),
        validTo: validTo?.toISOString() ?? null,
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
