---
name: chronos-route-procedure
description: Procedures for adding or changing Chronos API routes, Hono handlers, validators, OpenAPI metadata, authentication or authorization middleware, or feature router registration in apps/chronos/src/routes. Use when creating endpoints, wiring zod validators, describing responses with hono-openapi, or registering routers.
---
# Chronos Route Procedure

- Keep route work inside the feature folder under `apps/chronos/src/routes`, following the `_factory.ts`, `_router.ts`, and handler-file pattern used in `apps/chronos/src/routes/doorlock`.
- Match handler structure from files like `apps/chronos/src/routes/ping/index.ts`: `describeRoute(...)` first, then shared middleware, then validators, then the final handler.
- Request/response zod wire schemas live in `packages/api/src/domains/<domain>` (`@filcdev/api/domains/<name>`) so client apps share them — import from there instead of re-declaring. Schemas derived from Drizzle tables stay local to Chronos. Purely local helper schemas stay close to the route that uses them.
- Use `requireAuthentication` and `requireAuthorization(permissions.<name>)` middleware instead of inline permission checks; constants come from `@filcdev/api/permissions`. Never inline `'resource:action'` string literals.
- Return the established success envelope via the `ok()` helpers in `apps/chronos/src/utils/http.ts`; use `HTTPException` plus `StatusCodes` for error paths.
- Register every endpoint in the feature router (`_router.ts`) so the handler is reachable; do not wire ad hoc routes across the app.
- Ship complete OpenAPI metadata with the route change: tags via `filcExt(...)`, descriptions, and response documentation via `resolver(...)`.
