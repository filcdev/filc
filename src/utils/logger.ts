import {
  ansiColorFormatter,
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
} from '@logtape/logtape';
import { env } from '~/utils/environment';

export const configureLogger = async (rootName: string) => {
  await configure({
    reset: true,
    sinks: {
      console: getConsoleSink({
        formatter:
          env.mode === 'development' ? ansiColorFormatter : jsonLinesFormatter,
      }),
    },
    loggers: [
      {
        category: ['logtape', 'meta'],
        sinks: ['console'],
        lowestLevel: 'warning',
      },
      { category: rootName, lowestLevel: env.logLevel, sinks: ['console'] },
    ],
  });

  const logger = getLogger([rootName, 'meta']);
  logger.info(`Logger configured with level: ${env.logLevel}`);
};
