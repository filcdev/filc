---
description: "Use when adding or changing Chronos API routes, Hono handlers, validators, OpenAPI descriptions, authentication or authorization middleware, or feature router registration in apps/chronos/src/routes."
applyTo: "apps/chronos/src/routes/**/*.ts"
---
# Chronos Route Procedure

- Keep route work inside the feature folder under [apps/chronos/src/routes](../../apps/chronos/src/routes), following the `_factory.ts`, `_router.ts`, and handler-file pattern used in [apps/chronos/src/routes/doorlock](../../apps/chronos/src/routes/doorlock).
- Match handler structure from files like [apps/chronos/src/routes/roles/index.ts](../../apps/chronos/src/routes/roles/index.ts) and [apps/chronos/src/routes/ping/index.ts](../../apps/chronos/src/routes/ping/index.ts): `describeRoute(...)`, then shared middleware, then validators, then the final handler.
- Keep request and response Zod schemas close to the route that uses them. Avoid a separate “schemas” file unless the same schema is genuinely shared by multiple handlers in the same feature.
- Use `requireAuthentication` and `requireAuthorization(...)` middleware instead of inline permission checks. Reuse the existing permission naming style.
- Return the established success envelope and use `HTTPException` plus `StatusCodes` for error paths when the route already follows that pattern.
- Add or update the endpoint registration in the feature router, following [apps/chronos/src/routes/doorlock/_router.ts](../../apps/chronos/src/routes/doorlock/_router.ts), so the new handler is actually reachable.
- Keep OpenAPI metadata complete enough for the endpoint to stay discoverable: tags, descriptions, and response documentation should ship with the route change.