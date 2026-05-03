---
description: "Use when editing Chronos backend code, Hono routes, Drizzle schema files, OpenAPI handlers, auth middleware, or doorlock endpoints in apps/chronos."
applyTo: "apps/chronos/**"
---
# Chronos Backend Guidelines

- For common backend tasks, also use the focused procedure guides: [Chronos route procedure](chronos-route-procedure.instructions.md) and [Chronos schema procedure](chronos-schema-procedure.instructions.md).

- Follow the feature route layout in [apps/chronos/src/routes](../../apps/chronos/src/routes): keep `_factory.ts`, `_router.ts`, and handler files together inside the feature folder.
- New handlers should match patterns like [apps/chronos/src/routes/ping/index.ts](../../apps/chronos/src/routes/ping/index.ts): build them with `factory.createHandlers(...)`, keep Zod schemas close to the route, and include OpenAPI metadata with `describeRoute(...)` and `filcExt(...)`.
- Register endpoints from the feature router, following [apps/chronos/src/routes/doorlock/_router.ts](../../apps/chronos/src/routes/doorlock/_router.ts), instead of wiring ad hoc routes across the app.
- Reuse middleware such as `requireAuthorization('resource:action')` for permission checks. Do not inline authorization logic in handlers.
- Use `#` imports defined in [apps/chronos/package.json](../../apps/chronos/package.json) instead of long relative paths that cross feature boundaries.
- Edit schema sources under [apps/chronos/src/database/schema](../../apps/chronos/src/database/schema) and shared helpers like [apps/chronos/src/database/helpers.ts](../../apps/chronos/src/database/helpers.ts). Do not hand-edit SQL files under [apps/chronos/src/database/migrations](../../apps/chronos/src/database/migrations).
- When schema changes are intentional, generate migrations with the Chronos script in [apps/chronos/package.json](../../apps/chronos/package.json) after updating the TypeScript schema files.
- Backend work that touches auth, database access, or startup configuration may require values from [apps/chronos/.env.example](../../apps/chronos/.env.example).