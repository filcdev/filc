# Filc Agent Guidance

## Repo Shape

- This is a Bun + Turborepo monorepo. Shared scripts live in [package.json](package.json), task wiring lives in [turbo.json](turbo.json), and lint rules live in [biome.jsonc](biome.jsonc).
- [apps/chronos](apps/chronos) is the oRPC + Drizzle backend: it implements the contract from `packages/api` and serves an RPC endpoint for the apps plus an OpenAPI surface for external clients.
- [packages/api](packages/api) is the shared API contract package (`@filcdev/api`): the oRPC contract, the zod wire schemas per domain, the error map, permission constants and the typed client factory. Chronos implements the contract, iris and kiosk consume it, and it is the only place endpoint metadata lives. Future apps calling the Chronos API should depend on this package instead of the Chronos workspace.
- [packages/auth](packages/auth) is the shared auth surface (`@filcdev/auth`): the better-auth user fields, the session/user types and the browser client (`authClient`, `useSession`). Chronos passes the fields to better-auth and the apps read the client; `apps/chronos/src/_types/auth.ts` proves at compile time that the two still agree.
- [packages/mail](packages/mail) is the shared email package (`@filcdev/mail`): the SMTP transport (`createMailTransport`) and the react-email templates (`renderEmail`), carrying the Filc email styling and copy. Chronos renders and sends every notification email through it ([apps/chronos/src/utils/notifications/providers/smtp.ts](apps/chronos/src/utils/notifications/providers/smtp.ts) wires env and the per-type labels into it), so template markup and email copy live in `packages/mail/src/templates`.
- [packages/ui](packages/ui) is the shared design system (`@filcdev/ui`): the shadcn-style primitives, `cn`, `useIsMobile` and the theme tokens in `globals.css`. Iris imports them as `@filcdev/ui/components/*`, `@filcdev/ui/lib/utils`, `@filcdev/ui/hooks/*` and `@import "@filcdev/ui/globals.css"` (plus an `@source` for the package). App-agnostic primitives belong here; app-specific composition stays in the app.
- [apps/iris](apps/iris) is the React + Vite frontend.

## Commands

- Use `bun` only. Do not switch to `npm`, `pnpm`, or `yarn`.
- Run validation from the repo root in this order: `bun install` when dependencies change, `bun lint`, `bun typecheck`, `bun run build`.
- Do not use bare `bun build` from the repo root; the root build command is `bun run build`.
- No reliable repo-wide test command is documented. Do not invent one unless the task is explicitly about adding tests.
- Local Postgres is managed by the `pg-dispo` script (`pg-dispo start|stop|wipe`), not Docker Compose or devcontainers.

## Conventions

- Use the correct path alias for the app you are editing: `#...` in Chronos and `@/...` in Iris.
- An app never imports another app. Shared code lives in a package (`@filcdev/api`, `@filcdev/auth`, `@filcdev/ui`, …) or stays in the app that needs it.
- Do not hand-edit generated files such as [apps/iris/src/routeTree.gen.ts](apps/iris/src/routeTree.gen.ts), the SQL files under [apps/chronos/src/database/migrations](apps/chronos/src/database/migrations), or the OpenAPI documents under [apps/chronos/openapi](apps/chronos/openapi) (regenerate them with `bun run openapi:generate`).
- Backend commands that need auth or database configuration rely on [apps/chronos/.env.example](apps/chronos/.env.example).
- If a change crosses backend and frontend, keep the API contract and client usage aligned before finishing.
- Bun 1.4.0 ignores `[run] bun = true` from bunfig.toml when spawning package binaries. Scripts that need the Bun runtime (vite, drizzle-kit) must invoke them via `bun --bun <binary>`; see the `dev`, `build`, and `db:*` scripts.
- Every API error response carries a machine-readable `code` from the shared error map in [packages/api/src/errors.ts](packages/api/src/errors.ts), installed on the whole contract with `oc.errors(apiErrors)`. The map is what gives a code its HTTP status, its default message and its documented error response, so a new code is added there and nowhere else. Throw through the helpers in Chronos' `#utils/http` (`notFound`, `conflict`, `badRequest`, `forbidden`, `unauthorized`, `badGateway`, `serviceUnavailable`) or the `errors.<CODE>(...)` factories a handler receives; clients read the code off the thrown `ORPCError`.

## Logging And Observability

The app log is the first place to look when tracking a bug, and the record we leave for whoever debugs it next. Treat it as a golden source: log generously on the paths you touch, at a level that makes the detail available, because the difference between "it broke" and "this call returned 401 at 12:04 with this mac" is entirely in what we chose to emit.

- Use LogTape with one category per feature: `const logger = getLogger(['chronos', '<feature>', …])` (see [apps/chronos/src/utils/logger.ts](apps/chronos/src/utils/logger.ts) and the nesting in [apps/chronos/src/modules/wifi](apps/chronos/src/modules/wifi)). Pass values as the structured properties, never interpolated into the message — `logger.debug('radius auth rejected', { mac, nasIp, reason })` stays filterable by field and greppable in the JSON-lines production output.
- Choose the level by intent, and always leave the step-by-step detail in place: `trace`/`debug` for the stages of a code path, `info` for lifecycle and request summaries, `warning` for something recoverable and unexpected, `error` for what needs a human. `CHRONOS_LOG_LEVEL` defaults to `info` in the schema and to `debug` in [apps/chronos/.env.example](apps/chronos/.env.example), so debug (and trace) lines are expected on the paths you are working on — never strip them as noise, and never hide them behind a temporary flag or a comment-out.
- A catch block that swallows without logging is a bug we will never diagnose: no `catch {}`, no `.catch(() => null)` outside a deliberate, commented, recoverable case. Log the error object with the ids you were working with, at `debug`/`warning` when it is handled and `error` when it is not. The auth middleware's bare `.catch(() => null)` in this PR is the cautionary tale — it turned infrastructure failures into anonymous requests.
- Log and report: `logger.error` writes to stdout, which is the only production error channel today because `captureException` is used once in the whole backend. When a failure reaches a user or deserves an alert, send it to Sentry as well (`captureException` from `@sentry/bun`, cf. [apps/chronos/src/modules/wifi/utils/cleanup.ts](apps/chronos/src/modules/wifi/utils/cleanup.ts)).
- Every Chronos request carries an id: [apps/chronos/src/index.ts](apps/chronos/src/index.ts) takes the client's `x-request-id` or mints one, exposes it as `context.requestId`, logs it on the request line, and echoes it back in the `x-request-id` response header. Put `context.requestId` in the properties of anything you log inside a handler — that is what joins your line to the request, to the error boundary's line, and to a client report. The request line itself is `debug` in development and `info` in production.
- Non-`ORPCError` throws are logged with `message`, `stack` and the route context, then surfaced as a generic `INTERNAL` error, so a throw is never lost — that log is the only trace of the original failure in production, where the client sees the generic message. Make the properties there worth reading.
- Iris has no structured logger: client-side diagnosis is Sentry-based and sampled by [apps/iris/src/utils/telemetry.ts](apps/iris/src/utils/telemetry.ts). When a bug only reproduces in the browser, read the failing request's `x-request-id` response header and match it to the Chronos lines rather than guessing at timings.
- Sentry user context is attached per request by `resolveCaller` ([apps/chronos/src/middleware/auth.ts](apps/chronos/src/middleware/auth.ts)); keep the `setSentryUser(null)` on the anonymous path so an event is never attributed to the previous caller.

## Shared API Contracts (`@filcdev/api`)

- The contract is the single source of truth: `packages/api/src/contract/<feature>.ts` declares one procedure per endpoint as `oc.route(filcRoute({...})).input(...).output(...)`, and [packages/api/src/contract/index.ts](packages/api/src/contract/index.ts) mounts them all in `appContract`. Operation metadata (`method`, `path`, `operationId`, `tags`, `successStatus`) comes from `filcRoute` and is what the generated OpenAPI document — and the mobile client generated from it — reads, so it is not free to change. `auth: true` marks the operation with the document's `sessionAuth` scheme; there are no custom extensions.
- `.output(...)` is mandatory on every procedure: it types the apps and produces the external clients' models. `.input(...)` is ONE flat object — path params plus query (GET) or JSON body (POST/PUT/PATCH), same field names as the wire, no nesting. A file response is `z.file()`, a multipart upload takes the file as a `z.file()` field.
- Response payloads are the unwrapped value; there is no `{ success, data }` envelope. Drizzle `timestamp` columns are `z.date()` (the RPC transport round-trips `Date` objects and the OpenAPI serializer still emits `format: date-time`), `date()` columns are `z.string()`. Deletes answer `{ id }` — or `{ ok: true }` when there is no id — with status 200; nothing answers 204.
- Three shapes, no others. A **list** endpoint answers `{ items, total }`, built with `listResponse(item)` from [packages/api/src/domains/list.ts](packages/api/src/domains/list.ts) — `total` is the unpaged count, or the array's own length when the endpoint returns every row (never add a count query for it). A **single entity** answers the entity itself, never `{ <name>: entity }`. A **delete** answers `{ id }`. `bun run openapi:check` in [apps/chronos](apps/chronos) fails on a delete that returns a row and on a stale generated document.
- Every id is `z.uuid()` when its column is one: entity `id`s, the `*Id` fields referencing them, and the `{ id }` a delete answers with. The schema has to be true about what the column can hold, so a `text` column that happens to store uuid values — a few timetable tables — stays `z.string()`.
- Wire schemas (request bodies, path/query params, hand-written response payloads, entity rows) belong in `packages/api/src/domains/<domain>...`; apps and Chronos import them from `@filcdev/api/domains/<name>`. Entity schemas are hand-written there — `packages/api` must not import drizzle-orm or anything from `apps/chronos`, so Drizzle-derived schemas never cross the boundary.
- Permission strings are canonical constants from `@filcdev/api/permissions`. Never inline `'resource:action'` literals in middleware or UI gating; they are also stored in the `roles` table, so renaming requires a data migration.
- Frontend API calls go through the client built in `apps/<app>/src/utils/orpc.ts` from `createApiClient` (`@filcdev/api/client`), which returns `{ client, orpc }`: `client` for imperative calls, `orpc` for the TanStack Query utilities (`queryOptions`, `mutationOptions`, `key`). Errors arrive as an `ORPCError` — branch on `isDefinedError(error) && error.code === '…'` or on `error.status`.
- After any contract change, regenerate the OpenAPI document: `bun run openapi:generate` in [apps/chronos](apps/chronos) rewrites `openapi/chronos-openapi.json`, which is exactly the document `/api/doc/openapi.json` serves — both come from the options in [apps/chronos/src/utils/openapi-spec.ts](apps/chronos/src/utils/openapi-spec.ts). External clients consume that file as generated (mergen copies it to its own `openapi/filc-openapi.json`); nothing post-processes a per-consumer variant. Commit the regenerated file: `bun run openapi:check` fails when it is stale, and also when an `x-filc_type_name` hint names a response field the wire no longer carries.
- The document carries **no custom extensions**. It used to add `x-filc_group_name`, `x-filc_type_name` and `x-filc_auth` for a bespoke Kotlin codegen that has been abandoned; authentication is the standard `security` scheme and everything else a client needs is derived from the schemas. Do not reintroduce a per-route extension payload.

## Chronos Backend

### Routes

- A route is a procedure implementation: `base.<feature>.<procedure>.handler(...)`, where `base` is `implement(appContract)` from [apps/chronos/src/orpc.ts](apps/chronos/src/orpc.ts). Because it is bound to the contract, a missing, extra or mistyped procedure fails `tsc` rather than 404ing at runtime.
- Follow the module layout in [apps/chronos/src/modules](apps/chronos/src/modules): one folder per feature, holding its handler files, its `_router.ts` that exports a PLAIN object literal mirroring the contract nesting (`export const doorlockRouter = { devices: { list, create, … } }`), its `schema.ts`, its feature-private `utils/`, and — when it has any — a `_module.ts` manifest. `base.router({...})` requires the full contract, so it belongs in [apps/chronos/src/router.ts](apps/chronos/src/router.ts) and never in a module file.
- A module's `_module.ts` (`satisfies Module`, the shape in [apps/chronos/src/modules/module.ts](apps/chronos/src/modules/module.ts)) declares what the feature owns beyond its routes: `jobs` for scheduled work and `notifications` for the handlers it raises. [apps/chronos/src/modules/index.ts](apps/chronos/src/modules/index.ts) is the one list of modules, and `utils/cron.ts` and the notification bootstrap both read it — so a new feature registers its own tables, jobs and notifications instead of editing four shared files. A feature with nothing to contribute (a read-only view, a health probe) simply has no `_module.ts`.
- Tables are the exception: they go in [apps/chronos/src/modules/schemas.ts](apps/chronos/src/modules/schemas.ts), not in the manifest. `src/database/index.ts` constructs `db` at module load, so that list has to be importable without dragging a module's notification handlers — and through them the engine that queries `db` — into an import cycle.
- What a notification says, who receives it and which preference gates it live in the module's `_notifications.ts`, as one `NotificationHandler` object per type. The engine in [apps/chronos/src/utils/notifications/engine.ts](apps/chronos/src/utils/notifications/engine.ts) holds no per-type bookkeeping; it only exports the audience resolvers a handler calls.
- Handler shape: `handler(async ({ input, context }) => payload)`; read `input` (the flat object), `context.user`/`context.session` (non-null after a guard), `context.reqHeaders.get(...)`, `context.clientIp`, and add response headers with `context.resHeaders?.set(...)`.
- Reuse `requireAuthentication` and `requireAuthorization(permissions.<name>)` from [apps/chronos/src/middleware/auth.ts](apps/chronos/src/middleware/auth.ts) instead of inline permission checks.
- Success is `return payload` (the status comes from the route's `successStatus`); errors are thrown `ORPCError`s — the `#utils/http` helpers, or the `errors.<CODE>(...)` factories a handler/middleware receives.
- The transport lives in [apps/chronos/src/index.ts](apps/chronos/src/index.ts): `/api/rpc/*` answers the typed client, `/api/*` serves OpenAPI (`/api/doc/openapi.json`) and Swagger UI (`/api/doc/swagger`). Three surfaces are deliberately outside the contract and dispatched before the handlers: `GET /api/auth/*` (better-auth), the `/api/notifications/unsubscribe` HTML pages, and the aegis door-lock WebSocket at `GET /api/doorlock/ws`.

### Database Schema

- Change TypeScript schema sources: a feature's tables live in `apps/chronos/src/modules/<feature>/schema.ts`, and only the shared identity and RBAC tables stay in [apps/chronos/src/database/schema](apps/chronos/src/database/schema) (`authentication.ts`, `authorization.ts`, `api-keys.ts` — every other schema has a foreign key to them). Never hand-edit generated SQL under migrations.
- Reuse shared column helpers like [apps/chronos/src/database/helpers.ts](apps/chronos/src/database/helpers.ts) instead of re-declaring timestamp columns.
- Follow the table style in [apps/chronos/src/modules/doorlock/schema.ts](apps/chronos/src/modules/doorlock/schema.ts): explicit foreign keys, intentional `onDelete` behavior, indexes/composite keys where relationships need them.
- A new feature's tables are picked up by the schema glob in [apps/chronos/drizzle.config.ts](apps/chronos/drizzle.config.ts); add them to `src/modules/schemas.ts` so Drizzle's runtime schema matches.
- After intentional schema changes, generate the migration with the `db:*` scripts in [apps/chronos/package.json](apps/chronos/package.json).
- If backend route or frontend form code depends on a changed shape, update those callers in the same change rather than leaving a contract mismatch.

## Iris Frontend

### General

- Iris is a TanStack Start app: [apps/iris/src/router.tsx](apps/iris/src/router.tsx) builds a router (and QueryClient) per request, [apps/iris/src/client.tsx](apps/iris/src/client.tsx) hydrates it, [apps/iris/src/routes/__root.tsx](apps/iris/src/routes/__root.tsx) renders the document shell. Production is served by `srvx` over the build output (`srvx serve --prod -s ../client dist/server/server.js`); there is no custom server file. `bun run build && bun run start` serves everything from one process; the platform proxy (Traefik) routes `/api` to Chronos.
- `ssr` defaults to `true`; the authenticated tree is `ssr: 'data-only'` on [apps/iris/src/routes/_private/route.tsx](apps/iris/src/routes/_private/route.tsx), which every descendant inherits.
- A route's `loader` prefetches with `prefetch(() => context.queryClient.ensureQueryData(orpc.<feature>.<procedure>.queryOptions({ input })))` from [apps/iris/src/utils/orpc.ts](apps/iris/src/utils/orpc.ts) — the same call the component's hook makes, so hydration reads the cache instead of refetching. `prefetch` swallows a rejected prefetch because every screen is reachable without a session.
- Keep TanStack Router's canonical route-property order: `params`/`validateSearch` → `loaderDeps` → `context`/`beforeLoad` → `loader` → `head`. Each step contributes to the types the next one reads, so a `validateSearch` after `loader`/`loaderDeps` silently widens the search type to `{}`. Biome's `useSortedKeys` is off for `apps/iris/src/routes/**` for that reason (see the override in [biome.jsonc](biome.jsonc)) and react-doctor's `tanstack-start-route-property-order` guards the order — never hand-sort those keys to satisfy the formatter. Reading params off `location.searchStr` in a loader and declaring `loaderDeps` are both fine now that the order holds.
- A route module exports its `Route` and nothing else: any second export (a search schema, a helper) breaks Fast Refresh, so shared schemas live beside the data they describe (e.g. `@/hooks/timetable-public`) and the route imports them.
- An icon-only `Button` carries an `aria-label` built from an existing `t(...)` key.
- Per-request reads go through `createIsomorphicFn` thunks in [apps/iris/src/utils/request.ts](apps/iris/src/utils/request.ts) and [apps/iris/src/utils/i18n.ts](apps/iris/src/utils/i18n.ts) — the chain yields a value, so wrap it in an arrow to keep it callable per request. The oRPC client in [apps/iris/src/utils/orpc.ts](apps/iris/src/utils/orpc.ts) does the same, resolving the API origin and forwarding the request headers on the server.
- The session of a server render is read once in the root route and provided through `AuthSessionProvider` from `@filcdev/auth/client`; better-auth's own client only fetches a session in the browser.
- Keep a heavy island behind [apps/iris/src/components/lazy.tsx](apps/iris/src/components/lazy.tsx) when it only appears behind a dialog or a closed panel; `load` must be a module-level arrow.
- Keep user-facing text in `t(...)` and update both locale trees under [apps/iris/public/locales/en](apps/iris/public/locales/en) and [apps/iris/public/locales/hu](apps/iris/public/locales/hu).
- TanStack Form is the default form pattern: `useForm`, `useStore(form.store, selector)`, `<form.Field>{(field) => ...}</form.Field>` (see [apps/iris/src/components/doorlock/card-dialog.tsx](apps/iris/src/components/doorlock/card-dialog.tsx)).
- `form.reset(values)` takes raw values, not `{ values }`. Do **not** re-seed a form from a prop inside a `useEffect`: React Doctor flags it (`no-adjust-state-on-prop-change`), the effect re-runs on every render whenever one of its dependencies is recreated (`exhaustive-deps`), and when the defaults differ per call — a generated token or an array `key` — that is an endless render loop that takes the whole route down, since no route has an `errorComponent`. `kiosk-dialog` and `device-dialog` crashed this way.
- Instead let the dialog remount: the parent passes a `key` that changes when it opens and when the edited item changes — ``key={`${open ? 'open' : 'closed'}:${item?.id ?? 'new'}`}`` — so `useForm({ defaultValues })` seeds itself on mount and reopening discards edits, exactly as `form.reset` did. Keep those defaults stable regardless: never mint `crypto.randomUUID()` inside `initialState`/`toFormValues`.
- Base UI dropdown wrappers use `onClick`, not Radix-style `onSelect`, unless the local component exposes a different API.
- [packages/ui/src/components/chart.tsx](packages/ui/src/components/chart.tsx) already owns `ResponsiveContainer`; do not wrap chart children in another one.
- Keep public timetable filter state in TanStack Router search params instead of duplicating it in unrelated local state.

### Data Flow

- Domain data access lives in hook modules at [apps/iris/src/hooks](apps/iris/src/hooks) (one file per domain, e.g. `substitutions.ts`): `use<X>` query hooks plus individual `useCreateX`/`useUpdateX`/`useDeleteX` mutation hooks. Hooks own the API call, translated success/error toasts, and invalidation of every affected query family. Mutation hooks accept `{ onSaved?: () => void }` for callers that need to react to success (e.g. closing a dialog).
- Routes contain no inline API calls or `useMutation` blocks; they consume the domain hooks and keep only UI state (sort, filters, dialog open/close, selection). Reference shape: [apps/iris/src/routes/_private/admin/timetable/substitutions.tsx](apps/iris/src/routes/_private/admin/timetable/substitutions.tsx).
- Queries and mutations come from the generated utilities in [apps/iris/src/utils/orpc.ts](apps/iris/src/utils/orpc.ts): `useQuery({ ...orpc.<feature>.<procedure>.queryOptions({ input }), enabled })` and `useMutation(orpc.<feature>.<procedure>.mutationOptions({ onSuccess, onError }))`, then `mutate(flatInput)`. There are no hand-written query keys: invalidate with `queryClient.invalidateQueries({ queryKey: orpc.<feature>.<procedure>.key({ input }) })`, and a bare `.key()` matches every input of that procedure.
- Reuse [apps/iris/src/hooks/use-has-permission.ts](apps/iris/src/hooks/use-has-permission.ts) and existing permission guard components instead of duplicating permission logic in views.

### Dialogs And Forms

- Dialogs are self-contained: they call domain mutation hooks directly and close themselves via `onOpenChange(false)` from their `onSaved` callback. Do not pass payload-submit callbacks (`onSubmit`) into dialogs. Reference shape: [apps/iris/src/components/admin/substitution-dialog.tsx](apps/iris/src/components/admin/substitution-dialog.tsx).
- A dialog's submit handler calls `event.preventDefault()` as its first statement, before `form.handleSubmit()` / a manual branch. Two react-doctor rules point at that spot and only one can win: `tanstack-form-on-submit-requires-prevent-default` requires the call, `no-prevent-default` reports a form whose handler calls it. A dialog is client-only (Base UI portals it, nothing renders while closed), so the preventDefault stays and the `no-prevent-default` report is expected — as is a `tanstack-form-on-submit-requires-prevent-default` report when the handler branches after the call, because the detector treats any conditional as "not guaranteed". Neither is cleared by restructuring the handler to hide it.
- Follow the form idiom of [apps/iris/src/components/admin/user-dialog.tsx](apps/iris/src/components/admin/user-dialog.tsx): form near the top of the component, reactive slices via `useStore(form.store, selector)`, fields via `<form.Field>`. Plain `useState`+`onChange` forms are not acceptable for new or migrated code.
- Reuse validation schemas from [apps/iris/src/utils/form-schemas.ts](apps/iris/src/utils/form-schemas.ts) when available, or the shared domain contracts from `@filcdev/api` when validating against backend wire shapes. If a schema becomes shared by multiple dialogs, move it there instead of copying validation logic.
- Extend shared dialog prop types ([apps/iris/src/components/admin/admin.types.ts](apps/iris/src/components/admin/admin.types.ts), [apps/iris/src/components/doorlock/doorlock.types.ts](apps/iris/src/components/doorlock/doorlock.types.ts)) instead of defining near-duplicate props.


## Reuse And DRY

- Reuse existing helpers, types, schemas, and hooks before adding new ones. Check nearby feature folders first, then shared files: [apps/chronos/src/database/helpers.ts](apps/chronos/src/database/helpers.ts), [packages/api/src/contract](packages/api/src/contract), [packages/api/src/domains](packages/api/src/domains).
- When a second call site needs the same logic, extract or extend the existing abstraction instead of creating a parallel helper with a slightly different name.
- Keep abstractions local to the narrowest shared boundary that already exists. Do not create cross-app utilities for one feature-specific use.
- Prefer the smallest root-cause fix that matches neighboring code over broad rewrites or speculative cleanup.

## References

- Chronos scripts and package metadata: [apps/chronos/package.json](apps/chronos/package.json)
- Iris scripts and package metadata: [apps/iris/package.json](apps/iris/package.json)

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
