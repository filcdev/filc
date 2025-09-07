import {
  configure,
  getConsoleSink,
  jsonLinesFormatter,
} from '@logtape/logtape';
import { env } from '~/utils/environment';

export const configureLogger = async () => {
  await configure({
    sinks: {
      console: getConsoleSink({
        formatter:
          env.mode === 'development' ? jsonLinesFormatter : jsonLinesFormatter,
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
};
