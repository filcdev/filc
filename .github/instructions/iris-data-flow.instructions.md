---
description: "Use when adding or changing Iris route pages, React Query queries or mutations, permission-gated views, route search params, or frontend API consumption in apps/iris."
applyTo: "apps/iris/src/{routes,components}/**/*.tsx"
---
# Iris Data Flow Procedure

- Follow route composition patterns from files like [apps/iris/src/routes/_private/admin/news/system-messages.tsx](../../apps/iris/src/routes/_private/admin/news/system-messages.tsx): `createFileRoute(...)` at the top, then permission gating, then queries and mutations grouped near the component that owns them.
- Always use centralized keys from [apps/iris/src/utils/query-keys.ts](../../apps/iris/src/utils/query-keys.ts). Do not introduce inline array query keys for existing domains.
- Use `parseResponse(...)` and the generated Hono client from [apps/iris/src/utils/hc.ts](../../apps/iris/src/utils/hc.ts) for API requests when that is the local pattern.
- When a mutation changes server state, invalidate every affected query family, not just the page-local list. Follow the multi-invalidation pattern already used in admin news and doorlock screens.
- Reuse [apps/iris/src/hooks/use-has-permission.ts](../../apps/iris/src/hooks/use-has-permission.ts) and existing permission guard components instead of duplicating permission logic in the view.
- Keep search-param-driven page state in TanStack Router when the page already uses it for filters or selection. Do not fork that state into unrelated local state.
- New user-facing error and success messages should go through `t(...)` and the locale files, even when surfaced through toasts.