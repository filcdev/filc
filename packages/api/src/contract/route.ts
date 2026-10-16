import type { HTTPMethod, Route } from '@orpc/contract';

type FilcRoute = {
  /** HTTP method. */
  method: HTTPMethod;
  /** HTTP path. */
  path: `/${string}`;
  tags: readonly string[];
  operationId: string;
  description: string;
  /** Success response status. Optional because oRPC already defaults a route to
   * 200; only the endpoints that used `created()` name 201 here. */
  successStatus?: number;
  /** Whether the procedure needs a session — marks the operation with the
   * document's `sessionAuth` security scheme. */
  auth?: boolean;
};

/**
 * Build the route metadata for one procedure.
 *
 * The document carries no extensions: everything a client needs is standard
 * OpenAPI. Authentication is the declared `sessionAuth` scheme rather than a
 * custom key, which is what `components.securitySchemes` is for.
 *
 * `spec` is the callback form on purpose: the object form would replace the
 * whole generated operation, dropping the parameters, responses and tags oRPC
 * derives from the schemas.
 */
export const filcRoute = (input: FilcRoute): Route => ({
  description: input.description,
  method: input.method,
  operationId: input.operationId,
  path: input.path,
  spec: (current) => ({
    ...current,
    // The cookie itself is declared once in the document's `securitySchemes`
    // (see `openApiSpecOptions`); this only marks which procedures need it.
    ...(input.auth ? { security: [{ sessionAuth: [] }] } : {}),
  }),
  tags: [...input.tags],
  ...(input.successStatus ? { successStatus: input.successStatus } : {}),
});
