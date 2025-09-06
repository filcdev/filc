import { XMLParser } from 'fast-xml-parser';
import { StatusCodes } from 'http-status-codes';
import { logger } from '~/routes/timetable/_logger';
import { importFactory } from '~/routes/timetable/import/_factory';
import { TimetableExportRoot } from '~/utils/timetable/types';

export const importRoute = importFactory.createHandlers(async (c) => {
  const body = await c.req.parseBody();

  // get file
  const file = body.file as File;

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

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: 'text',
    parseTagValue: true,
    parseAttributeValue: true,
    trimValues: true,
  });

  let xmlData: TimetableExportRoot | null = null;
  try {
    xmlData = parser.parse(text);
  } catch (e) {
    logger.error('Failed to parse XML', { error: e });
    return c.json(
      {
        status: 'error',
        message: 'Failed to parse XML',
      },
      StatusCodes.BAD_REQUEST
    );
  }

  // check that we got valid data
  if (!xmlData?.timetable) {
    return c.json(
      {
        status: 'error',
        message: 'Invalid timetable data',
      },
      StatusCodes.BAD_REQUEST
    );
  }



  logger.info('Imported timetable', { xmlData });

  return c.json({
    status: 'ok',
  });
});
