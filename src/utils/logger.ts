import {
  ansiColorFormatter,
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
} from '@logtape/logtape';
import { env } from '~/utils/environment';

export const configureLogger = async () => {
  await configure({
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
      { category: 'chronos', lowestLevel: env.logLevel, sinks: ['console'] },
    ],
  });

  const logger = getLogger(['chronos', 'meta']);
  logger.info(`Logger configured with level: ${env.logLevel}`);
};
