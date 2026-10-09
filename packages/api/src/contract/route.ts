import type { HTTPMethod, Route } from '@orpc/contract';

type FilcRoute = {
  /** HTTP method, copied from the pre-migration OpenAPI document. */
  method: HTTPMethod;
  /** HTTP path, copied from the pre-migration OpenAPI document. */
  path: `/${string}`;
  tags: readonly string[];
  operationId: string;
  description: string;
  /** Success response status: 201 for the endpoints that used `created()`. */
  successStatus: number;
  /**
   * `x-filc_group_name`: the group mergen's generated client nests the model
   * under. Omitted (or empty) when the pre-migration document had no such key
   * for the operation — an empty string would add a key the diff would flag.
   */
  group?: string;
  /** `x-filc_type_name`: the Kotlin type declaration for the response. Same omission rule. */
  type?: string;
  /** Whether the procedure needs a session — renders as `x-filc_auth: 'true'`. */
  auth?: boolean;
};

/**
 * Build the route metadata for one procedure. `method`, `path`, `tags`,
 * `operationId`, `description`, `successStatus` and the `x-filc_*` extension
 * values are copied verbatim from `apps/chronos/openapi/baseline.json` so the
 * generated document (and mergen's generated Kotlin client, which reads these
 * keys) stays compatible with the pre-oRPC API.
 *
 * `spec` is the callback form on purpose: the object form would replace the
 * whole generated operation, dropping the parameters and responses oRPC
 * derives from the schemas.
 */
export const filcRoute = (input: FilcRoute): Route => ({
  description: input.description,
  method: input.method,
  operationId: input.operationId,
  path: input.path,
  spec: (current) => ({
    ...current,
    ...(input.group ? { 'x-filc_group_name': input.group } : {}),
    ...(input.type ? { 'x-filc_type_name': input.type } : {}),
    ...(input.auth ? { 'x-filc_auth': 'true' } : {}),
    // The cookie itself is declared once in the document's `securitySchemes`
    // (see `openApiSpecOptions`); this only marks which procedures need it.
    ...(input.auth ? { security: [{ sessionAuth: [] }] } : {}),
  }),
  successStatus: input.successStatus,
  tags: [...input.tags],
});
