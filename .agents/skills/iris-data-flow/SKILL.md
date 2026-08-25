---
name: iris-data-flow
description: Procedures for adding or changing Iris route pages, React Query queries or mutations, permission-gated views, route search params, or frontend API consumption in apps/iris. Use when creating pages under apps/iris/src/routes, wiring useQuery/useMutation, gating UI on permissions, or calling the Chronos API.
---
# Iris Data Flow Procedure

- Follow route composition patterns from files like `apps/iris/src/routes/_private/admin/news/system-messages.tsx`: `createFileRoute(...)` at the top, then permission gating, then queries and mutations grouped near the component that owns them.
- Always use centralized keys from `apps/iris/src/utils/query-keys.ts`. Do not introduce inline array query keys for existing domains.
- Call the API through the typed client built in `apps/iris/src/utils/hc.ts` (`createApiClient` from `@filcdev/api/client`) and unwrap envelopes via `useApiQuery`/`useApiMutation` in `apps/iris/src/utils/api.ts` (backed by the shared `unwrapResponse`, which throws a structured `ApiError`). Do not re-introduce raw `parseResponse` handling.
- When a mutation changes server state, invalidate every affected query family, not just the page-local list. Follow the multi-invalidation pattern already used in admin news and doorlock screens.
- Reuse `apps/iris/src/hooks/use-has-permission.ts` and existing permission guard components instead of duplicating permission logic in views; permission constants come from `@filcdev/api/permissions`.
- Keep search-param-driven page state in TanStack Router when the page already uses it for filters or selection. Do not fork that state into unrelated local state.
- New user-facing error and success messages go through `t(...)` and both locale trees (`apps/iris/public/locales/en`, `apps/iris/public/locales/hu`), even when surfaced through toasts.
