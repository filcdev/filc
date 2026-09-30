# Architecture

## Repository shape

Monorepo (Bun + Turborepo) with three apps and four shared packages:

| Workspace | Tech | Responsibility |
| --- | --- | --- |
| `apps/chronos` | oRPC + Drizzle + better-auth | API server (contract implementation), auth, scheduled jobs, database |
| `apps/iris` | React 19 + Vite + TanStack Router/Query/Form | Web frontend |
| `apps/kiosk` | React 19 + Vite + TanStack Router/Query | Kiosk and TV displays (static bundle, talks to the API by absolute URL) |
| `packages/api` (`@filcdev/api`) | oRPC + zod + TypeScript | The API contract, shared wire schemas, the error map, permission constants, typed client |
| `packages/auth` (`@filcdev/auth`) | better-auth + TypeScript | The better-auth user fields, session/user types and the browser auth client shared by the apps |
| `packages/ui` (`@filcdev/ui`) | React + Tailwind | Shared design-system primitives, consumed as source |
| `packages/navigator-3d` (`@filcdev/navigator-3d`) | three.js + React | Campus 3D viewer/editor used by iris and kiosk |
| `packages/timetable-import` (`@filcdev/timetable-import`) | TypeScript + zod | Format-agnostic timetable importer core, used by chronos |

## Request flow

One contract, three transports:

```
                      packages/api/src/contract  (oc.route + filcRoute + zod schemas)
                        │                     │
   iris ── /api/rpc ────┤                     ├──── /api (OpenAPI)  →  mergen (generated Kotlin client)
   kiosk ─ /api/rpc ────┘                     │
                                   apps/chronos/src/router.ts  (base.router, completeness enforced by tsc)
                                              │
                                        Drizzle → Postgres
```

The apps call the contract through the typed oRPC client built in `apps/iris/src/utils/orpc.ts` and `apps/kiosk/src/utils/orpc.ts` (`createApiClient` from `@filcdev/api/client`), which posts to `/api/rpc/<procedure path>` and returns the payload directly — the payload is the value, not an envelope. Errors arrive as an `ORPCError` carrying the machine-readable `code` from [packages/api/src/errors.ts](../packages/api/src/errors.ts) and its HTTP status; callers branch with `isDefinedError(error) && error.code === '…'` or on `error.status`.

External consumers get plain HTTP: every procedure also appears in the OpenAPI document the contract generates, which is what `mergen` compiles its client from.

## Backend (chronos)

- **Module layout**: `apps/chronos/src/modules/<feature>/` is one self-contained folder per feature — handler files, a `_router.ts` that exports a plain object literal mirroring the contract's nesting, `schema.ts` for its tables, and `utils/` for helpers only it uses. `src/router.ts` assembles the routers with `base.router({...})`, which fails to compile if a procedure is missing, extra, or mistyped, so that list stays spelled out rather than assembled. `src/orpc.ts` holds the `base = implement(appContract)` implementer.
- **What a module registers**: a feature's `_module.ts` (`satisfies Module`) declares its cron `jobs` and its notification `notifications`; `src/modules/index.ts` lists the modules and both `utils/cron.ts` and the notification bootstrap read it, so adding scheduled work or a notification no longer means editing a shared file. A notification's audience and preference gate live on the handler itself in the module's `_notifications.ts`, leaving the engine with no per-type bookkeeping. Tables are the exception and live in `src/modules/schemas.ts`, because `db` is constructed at module load and must not import runtime behaviour through a cycle.
- **OpenAPI**: the document is generated from the contract ([packages/api/src/contract](../packages/api/src/contract)), served at `/api/doc/openapi.json` with Swagger UI at `/api/doc/swagger`, and committed as `apps/chronos/openapi/chronos-openapi.json` by `bun run openapi:generate` — the committed file *is* the served document, both produced by the shared options in [apps/chronos/src/utils/openapi-spec.ts](../apps/chronos/src/utils/openapi-spec.ts) (info, servers, security scheme, the single error-body shape). External clients (mergen) consume that file as generated. The contract's `filcRoute` metadata (`operationId`, `tags`, `x-filc_*`, `security`) is what generators read, so it is copied verbatim from the pre-migration document rather than invented.
- **Non-RPC surfaces**: `GET /api/auth/*` (better-auth), the `/api/notifications/unsubscribe` HTML pages, and the aegis door-lock WebSocket (`GET /api/doorlock/ws`, a hand-rolled JSON protocol the firmware speaks) are dispatched from `src/index.ts` before the oRPC handlers — deliberately outside the contract.
- **Auth**: `requireAuthentication` and `requireAuthorization(permissions.<name>)` oRPC middlewares; permission strings are canonical constants from `@filcdev/api/permissions` (never inline `'resource:action'` literals).
- **Database**: Drizzle schema sources sit next to the feature that owns them (`apps/chronos/src/modules/<feature>/schema.ts`), with only the shared identity and RBAC tables in `apps/chronos/src/database/schema`; `drizzle.config.ts` globs both. Migrations are generated (`bun run db:generate`) and never hand-edited. The repo root [`compose.yml`](../compose.yml) runs a local Postgres 18 instance (Alpine) as the dev database; run `docker compose up -d` and see CONTRIBUTING.md for the alternative `pg-dispo` flow.
- **Success/errors**: a handler returns its payload and the route's `successStatus` supplies the status; failures throw `ORPCError`s built by the `#utils/http` helpers, all of whose codes and statuses come from the shared error map installed with `oc.errors(apiErrors)`.

## Frontend (iris)

- **Data access** lives in domain hook modules (`apps/iris/src/hooks/<domain>.ts`): query + mutation hooks that own API calls, translated toasts, and query invalidation. Routes keep only UI state (filters, dialog open/close, selection).
- **Queries and keys** come from `apps/iris/src/utils/orpc.ts`: `orpc.<feature>.<procedure>.queryOptions({ input })`, `.mutationOptions(...)` and `.key({ input })` (a bare `.key()` partial-matches the procedure's whole input family). No hand-written key arrays.
- **Forms**: TanStack Form (`useForm` + `<form.Field>`) — see `apps/iris/src/components/doorlock/card-dialog.tsx`. Dialogs call domain mutation hooks directly and close via `onSaved`.
- **i18n**: `i18next` with `en` and `hu` locale trees under `apps/iris/public/locales`.
- **SSR**: TanStack Start. `apps/iris/src/router.tsx` builds a router + QueryClient per request, `apps/iris/src/routes/__root.tsx` renders the document shell, and `apps/iris/server.ts` is the production entry (Start handler plus the `dist/client` assets). Public and auth routes render fully; the `_private` tree is `ssr: 'data-only'`, so its loaders still prefetch on the server but its components render in the browser. Route loaders prefetch with `prefetch(context.queryClient, orpc.<feature>.<procedure>.queryOptions({ input }))` from `apps/iris/src/utils/orpc.ts`, which is the same call the component's hook makes, so hydration reads the cache instead of refetching.
- **Route tree**: generated by TanStack Start (`apps/iris/src/routeTree.gen.ts`) — never edited by hand.
- **Permissions**: `use-has-permission.ts` hook and existing guard components; no duplicated permission logic in views.

## Auth

better-auth on the server (`apps/chronos/src/utils/authentication.ts`) with Entra (Microsoft) as social provider. The user fields, the session/user types and the browser client live in `packages/auth` (`@filcdev/auth`), so an app imports a package and never another app: the server passes the shared field definitions to better-auth, clients call `authClient` / `useSession()` from `@filcdev/auth/client`, and `apps/chronos/src/_types/auth.ts` fails to compile if the server's real session stops matching the shared types. OAuth setup: [entra-setup.md](entra-setup.md).

## Docs

- [CONTRIBUTING.md](../CONTRIBUTING.md) — onboarding and contribution workflow
- [AGENTS.md](../AGENTS.md) — authoritative code conventions (also consumed by AI agents)
- This directory — reference material that outlives a single contribution
