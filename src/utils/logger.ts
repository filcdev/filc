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
          env.mode === 'development' ? ansiColorFormatter : jsonLinesFormatter,
      }),
    },
  });

  const logger = getLogger([rootName, 'meta']);
  logger.info(`Logger configured with level: ${env.logLevel}`);
};
