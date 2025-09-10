// import { XMLParser } from "fast-xml-parser";
// import type { TimetableExportRoot } from "~/utils/timetable/types";

import { getLogger } from '@logtape/logtape';
import { StatusCodes } from 'http-status-codes';
import { DOMParser } from 'xmldom';
import { importFactory } from '~/routes/timetable/import/_factory';
import { importTimetableXML } from '~/utils/timetable/imports';

const logger = getLogger(['chronos', 'timetable']);

export const importRoute = importFactory.createHandlers(async (c) => {
  const body = (await c.req.parseBody()) as {
    omanXml?: File;
  };

  // get file
  const file = body.omanXml as File;

  if (!file) {
    return c.json(
      {
        status: 'error',
        message: 'No file provided',
      },
      StatusCodes.BAD_REQUEST
    );
  }

  // check that we got valid XML
  if (file.type !== 'text/xml' && file.type !== 'application/xml') {
    return c.json(
      {
        status: 'error',
        message: 'Invalid file type',
      },
      StatusCodes.BAD_REQUEST
    );
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
    const xmlData = new DOMParser().parseFromString(text, 'application/xml');

    await importTimetableXML(xmlData);

    logger.info('Imported timetable');
  } catch (e) {
    logger.error(`Failed to parse XML: ${e}`);
    return c.json(
      {
        status: 'error',
        message: 'Failed to parse XML',
      },
      StatusCodes.BAD_REQUEST
    );
  }

  return c.json({
    status: 'ok',
  });
});
