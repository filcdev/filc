import { mkdir, writeFile } from 'node:fs/promises';
import { getLogger } from '@logtape/logtape';
import { configureLogger } from '#utils/logger';
import {
  buildOpenApiDocument,
  serializeOpenApiDocument,
} from './openapi-document';

/**
 * Writes `openapi/chronos-openapi.json` — the document `/api/doc/openapi.json`
 * serves, byte for byte, from the same options the server uses
 * (`#utils/openapi-spec`). Nothing is post-processed: external clients consume
 * this file as generated.
 *
 * Run with `bun run openapi:generate` after any contract change, then refresh a
 * consumer's copy (e.g. mergen's `openapi/filc-openapi.json`). `bun run
 * openapi:check` fails when this file is stale instead of writing it.
 */

const spec = await buildOpenApiDocument();

await mkdir('openapi', { recursive: true });
await writeFile('openapi/chronos-openapi.json', serializeOpenApiDocument(spec));

await configureLogger('chronos');
getLogger(['chronos', 'openapi']).info(
  `Wrote openapi/chronos-openapi.json (${Object.keys(spec.paths ?? {}).length} paths)`
);
