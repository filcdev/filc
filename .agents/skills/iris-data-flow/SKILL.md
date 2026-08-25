---
name: iris-data-flow
description: Procedures for adding or changing Iris route pages, React Query queries or mutations, permission-gated views, route search params, or frontend API consumption in apps/iris. Use when creating pages under apps/iris/src/routes, wiring useQuery/useMutation, gating UI on permissions, or calling the Chronos API.
---
# Iris Data Flow Procedure

- Follow route composition patterns from files like `apps/iris/src/routes/_private/admin/timetable/substitutions.tsx`: `createFileRoute(...)` at the top, then permission gating, then page state (sort/filters/dialogs) fed by domain hooks.
- Domain data access lives in hook modules at `apps/iris/src/hooks/<domain>.ts` (see `substitutions.ts`): `use<X>` query hooks plus `useCreateX`/`useUpdateX`/`useDeleteX` mutation hooks. Hooks own the API call, translated toasts, and invalidation of every affected family; mutation hooks take `{ onSaved?: () => void }`.
- Routes contain no inline `parseResponse`/`useMutation` blocks — they consume the domain hooks and keep only UI state (sort, filters, dialog open/close, selection). Reference: `apps/iris/src/routes/_private/admin/timetable/substitutions.tsx`.
- Multi-parameter query keys take a single object argument (e.g. `queryKeys.doorlock.logs({ deviceFilter, search, ... })`) so React Query partial matching works.
- Reuse `apps/iris/src/hooks/use-has-permission.ts` and existing permission guard components instead of duplicating permission logic in views; permission constants come from `@filcdev/api/permissions`.
- New user-facing error and success messages go through `t(...)` and both locale trees (`apps/iris/public/locales/en`, `apps/iris/public/locales/hu`), even when surfaced through toasts.
