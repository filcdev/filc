---
description: "Use when refactoring, deduplicating code, extracting helpers, or adding TypeScript or React code in apps. Covers DRY, reuse-first changes, and shared utility discovery in Chronos and Iris."
applyTo: "apps/**/*.{ts,tsx}"
---
# Filc Reuse And DRY Guidelines

- Reuse existing helpers, types, schemas, and hooks before adding new ones. Check nearby feature folders first, then shared files such as [apps/chronos/src/database/helpers.ts](../../apps/chronos/src/database/helpers.ts), [apps/iris/src/utils/query-keys.ts](../../apps/iris/src/utils/query-keys.ts), [apps/iris/src/hooks/use-has-permission.ts](../../apps/iris/src/hooks/use-has-permission.ts), [apps/iris/src/components/admin/admin.types.ts](../../apps/iris/src/components/admin/admin.types.ts), and [apps/iris/src/components/doorlock/doorlock.types.ts](../../apps/iris/src/components/doorlock/doorlock.types.ts).
- When a second call site needs the same logic, prefer extracting or extending the existing abstraction instead of creating a parallel helper with a slightly different name.
- Keep abstractions local to the narrowest shared boundary that already exists. Do not create cross-app utilities for one feature-specific use.
- Extend existing dialog props, response shapes, and query key families instead of re-declaring near-identical types in each file.
- Prefer the smallest root-cause fix that matches neighboring code over broad rewrites or speculative cleanup.
- Keep imports on the app alias boundary: `#...` for Chronos and `@/...` for Iris.