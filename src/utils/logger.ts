import {
  configure,
  getConsoleSink,
  jsonLinesFormatter,
} from '@logtape/logtape';
import { prettyFormatter } from '@logtape/pretty';
import { env } from '~/utils/environment';

export const configureLogger = async () => {
  await configure({
    sinks: {
      console: getConsoleSink({
        formatter:
          env.mode === 'development' ? prettyFormatter : jsonLinesFormatter,
      }),
    },
    loggers: [
      {
        category: ['logtape', 'meta'],
        sinks: ['console'],
        lowestLevel: 'warning',
      },
      { category: 'chronos', lowestLevel: 'trace', sinks: ['console'] },
    ],
  });
};
