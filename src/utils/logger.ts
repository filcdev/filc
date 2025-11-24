import {
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
} from '@logtape/logtape';
import { env } from '~/utils/environment';

const prettyFormatter = async () => {
  if (env.mode === 'production') {
    return jsonLinesFormatter;
  }

  // import getPrettyFormatter from '@logtape/pretty';
  const { getPrettyFormatter } = await import('@logtape/pretty');
  return getPrettyFormatter({
    colors: true,
    properties: true,
    timestamp: 'time',
  });
};

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
          env.mode === 'development'
            ? await prettyFormatter()
            : jsonLinesFormatter,
      }),
    },
  });

  const logger = getLogger([rootName, 'meta']);
  logger.info(`Logger configured with level: ${env.logLevel}`);
};
