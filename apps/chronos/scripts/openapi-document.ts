import { appContract } from '@filcdev/api/contract';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { openApiSpecOptions } from '#utils/openapi-spec';

/**
 * Builds the Chronos OpenAPI document in memory. Shared by
 * `generate-openapi.ts` (which writes it) and `check-openapi.ts` (which checks
 * the committed copy), so the two can never drift from each other.
 *
 * The document is exactly what `/api/doc/openapi.json` serves: the same
 * contract and the same options (`#utils/openapi-spec`), nothing
 * post-processed.
 */
export const buildOpenApiDocument = () =>
  new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  }).generate(appContract, openApiSpecOptions);

/** The exact bytes that belong in `openapi/chronos-openapi.json`. */
export const serializeOpenApiDocument = (spec: unknown): string =>
  `${JSON.stringify(spec, null, 2)}\n`;
