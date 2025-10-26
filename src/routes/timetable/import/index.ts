// import { XMLParser } from "fast-xml-parser";
// import type { TimetableExportRoot } from "~/utils/timetable/types";

import { getLogger } from '@logtape/logtape';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
import { decode, encode } from 'iconv-lite';
import { DOMParser } from 'xmldom';
import { timetableFactory } from '~/routes/timetable/_factory';
import { env } from '~/utils/environment';
import type { SuccessResponse } from '~/utils/globals';
import {
  requireAuthentication,
  requireAuthorization,
} from '~/utils/middleware';
import { importTimetableXML } from '~/utils/timetable/imports';

const logger = getLogger(['chronos', 'timetable']);

export const importRoute = timetableFactory.createHandlers(
  requireAuthentication,
  requireAuthorization('import:timetable'),
  async (c) => {
    const body = (await c.req.parseBody()) as {
      omanXml?: File;
      name?: string;
      validFrom?: Date;
    };

    // get file
    const file = body.omanXml as File;
    const name = body.name;
    const validFrom = body.validFrom;

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
    // TODO: this is still broken
    const utf8Text = encode(decoded, 'utf-8').toString();
    const cleaned = utf8Text.replace('Period=""', '');

    // TODO: Rewrite the import function to use these
    // types so we are more typeish :3.
    // const parser = new XMLParser({
    //   ignoreAttributes: false,
    //   attributeNamePrefix: "",
    //   textNodeName: "text",
    //   parseTagValue: true,
    //   parseAttributeValue: true,
    //   trimValues: true,
    // });

    // let xmlData: TimetableExportRoot | null = null;
    try {
      logger.info('Starting timetable import');
      const xmlData = new DOMParser().parseFromString(
        cleaned,
        'application/xml'
      );

      await importTimetableXML(xmlData, {
        name,
        validFrom: validFrom.toString(),
      });

      logger.info('Imported timetable');

      return c.json<SuccessResponse>({
        success: true,
      });
    } catch (e) {
      logger.error(`Failed to parse XML: ${e}`);
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Failed to parse XML',
        cause: env.mode === 'development' ? String(e) : undefined,
      });
    }
  }
);
