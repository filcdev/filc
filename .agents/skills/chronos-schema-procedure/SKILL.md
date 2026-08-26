---
name: chronos-schema-procedure
description: Procedures for editing Chronos Drizzle schema files, table relationships, indexes, timestamps, and preparing migrations from apps/chronos/src/database/schema. Use when adding or altering tables or columns, changing relations, or generating database migrations.
---
# Chronos Schema Procedure

- Change TypeScript schema sources under `apps/chronos/src/database/schema`; never hand-edit generated SQL under `apps/chronos/src/database/migrations`.
- Reuse shared column helpers from `apps/chronos/src/database/helpers.ts` instead of re-declaring timestamp columns.
- Follow the table style in `apps/chronos/src/database/schema/doorlock.ts`: explicit foreign keys, intentional `onDelete` behavior, and indexes or composite keys where the relationship needs them.
- Keep exported schema collections updated when a new table belongs to an existing domain module.
- After intentional schema changes, generate the migration with the `db:*` scripts from `apps/chronos/package.json`.
- If backend route or frontend form code depends on a changed shape, update those callers in the same change rather than leaving the repo in a contract mismatch. Wire-facing response shapes may belong in `packages/api/src/domains` — update those contracts together with the tables.
