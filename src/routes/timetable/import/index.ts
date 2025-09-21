// import { XMLParser } from "fast-xml-parser";
// import type { TimetableExportRoot } from "~/utils/timetable/types";

import { getLogger } from '@logtape/logtape';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes } from 'http-status-codes';
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
    };

    // get file
    const file = body.omanXml as File;

    if (!file) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'No file provided',
      });
    }

    // check that we got valid XML
    if (file.type !== 'text/xml' && file.type !== 'application/xml') {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: 'Invalid file type, must be XML',
      });
    }

    // parse file
    const text = await file.text();

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
      const xmlData = new DOMParser().parseFromString(text, 'application/xml');

      await importTimetableXML(xmlData);

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
