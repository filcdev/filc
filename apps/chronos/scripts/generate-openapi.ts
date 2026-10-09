import { mkdir, writeFile } from 'node:fs/promises';
import { appContract } from '@filcdev/api/contract';
import { getLogger } from '@logtape/logtape';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { configureLogger } from '#utils/logger';
import { openApiSpecOptions } from '#utils/openapi-spec';

/**
 * Writes `openapi/chronos-openapi.json` — the document `/api/doc/openapi.json`
 * serves, byte for byte, from the same options the server uses
 * (`#utils/openapi-spec`). Nothing is post-processed: external clients consume
 * this file as generated.
 *
 * Run with `bun run openapi:generate` after any contract change, then refresh a
 * consumer's copy (e.g. mergen's `openapi/filc-openapi.json`).
 */

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(appContract, openApiSpecOptions);

await mkdir('openapi', { recursive: true });
await writeFile(
  'openapi/chronos-openapi.json',
  `${JSON.stringify(spec, null, 2)}\n`
);

await configureLogger('chronos');
getLogger(['chronos', 'openapi']).info(
  `Wrote openapi/chronos-openapi.json (${Object.keys(spec.paths ?? {}).length} paths)`
);
