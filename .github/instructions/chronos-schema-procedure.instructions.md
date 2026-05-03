---
description: "Use when editing Chronos Drizzle schema files, relationships, indexes, timestamps, or preparing migrations from apps/chronos/src/database/schema."
applyTo: "apps/chronos/src/database/schema/**/*.ts"
---
# Chronos Schema Procedure

- Change TypeScript schema sources under [apps/chronos/src/database/schema](../../apps/chronos/src/database/schema). Do not hand-edit generated SQL under [apps/chronos/src/database/migrations](../../apps/chronos/src/database/migrations).
- Reuse shared column helpers like [apps/chronos/src/database/helpers.ts](../../apps/chronos/src/database/helpers.ts) instead of re-declaring timestamp columns.
- Follow the table style in [apps/chronos/src/database/schema/doorlock.ts](../../apps/chronos/src/database/schema/doorlock.ts): keep foreign keys explicit, specify `onDelete` behavior intentionally, and add indexes or composite keys where the relationship needs them.
- Keep exported schema collections updated when a new table belongs to an existing domain module.
- After intentional schema changes, generate the migration with the Chronos script from [apps/chronos/package.json](../../apps/chronos/package.json). Do not manually patch migration SQL unless the task explicitly requires it.
- If backend route or frontend form code depends on the changed shape, update those callers in the same change rather than leaving the repo in a contract mismatch.