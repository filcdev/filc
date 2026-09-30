import type { OpenAPIGeneratorGenerateOptions } from '@orpc/openapi';

/**
 * better-auth prefixes its cookies with `authOptions.advanced.cookiePrefix`
 * (`filc`), so the session cookie is `filc.session_token` — the name the
 * generated external clients authenticate with.
 */
export const SESSION_COOKIE_NAME = 'filc.session_token';

/**
 * The one place the OpenAPI document is configured. `src/index.ts` serves it at
 * `/api/doc/openapi.json` and `scripts/generate-openapi.ts` writes it to
 * `openapi/chronos-openapi.json`, so the committed file *is* the served
 * document — the same generator input, no per-consumer post-processing.
 */
export const openApiSpecOptions = {
  components: {
    securitySchemes: {
      sessionAuth: { in: 'cookie', name: SESSION_COOKIE_NAME, type: 'apiKey' },
    },
  },
  /**
   * One error shape for every status. The default shaper emits a `oneOf` per
   * defined code, which clients (and openapi-generator's Kotlin output) handle
   * badly; this keeps the codes, message and status and drops the union.
   */
  customErrorResponseBodySchema: () => ({
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      status: { type: 'integer' },
    },
    required: ['code', 'message', 'status'],
    type: 'object',
  }),
  // The notifications endpoints are internal to the apps: they predate the
  // OpenAPI metadata convention, so they are procedures without a public
  // description. Drop the `filter` to publish them.
  filter: ({ path }) => path[0] !== 'notifications',
  info: {
    description: 'API for consumption by the Filc app family.',
    title: 'Chronos backend API',
    version: '0.0.1',
  },
  servers: [
    { description: 'chronos', url: 'https://filc.petrik.hu/api' },
    { description: 'Local Server', url: 'http://localhost:3000/api' },
  ],
} satisfies OpenAPIGeneratorGenerateOptions;
