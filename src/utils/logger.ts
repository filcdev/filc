import {
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
} from '@logtape/logtape';
import { getPrettyFormatter } from '@logtape/pretty';
import { env } from '~/utils/environment';

const prettyFormatter = getPrettyFormatter({
  colors: true,
  properties: true,
  timestamp: 'time',
});

export const configureLogger = async (rootName: string) => {
  await configure({
    loggers: [
      {
        category: ['logtape', 'meta'],
        lowestLevel: 'warning',
        sinks: ['console'],
      },
      { category: rootName, lowestLevel: env.logLevel, sinks: ['console'] },
    ],
    reset: true,
    sinks: {
      console: getConsoleSink({
        formatter:
          env.mode === 'development' ? prettyFormatter : jsonLinesFormatter,
      }),
    },
  });

  const logger = getLogger([rootName, 'meta']);
  logger.info(`Logger configured with level: ${env.logLevel}`);
};
