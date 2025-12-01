const ms = Date.now();

import { getLogger } from '@logtape/logtape';
import { configureLogger } from '@/utils/logger';
import packagesJson from './package.json';

const dependencies = Object.keys(packagesJson.dependencies ?? {});

await configureLogger('chronos');

const logger = getLogger(['chronos', 'build']);
logger.info('Building Chronos server...');

await Bun.build({
  entrypoints: ['src/index.ts'],
  external: dependencies,
  minify: true,
  outdir: 'dist',
  packages: 'bundle',
  sourcemap: true,
  target: 'bun',
});

logger.info(`Built Chronos server in ${Date.now() - ms}ms`)