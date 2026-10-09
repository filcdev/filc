---
name: chronos-schema-procedure
description: Procedures for editing Chronos Drizzle schema tables, columns, relations, indexes, or generating database migrations. Use when adding or altering tables or columns in module schemas, changing relations, or preparing migrations with the db:* scripts.
---
# Chronos Schema Procedure

- Feature tables live in `apps/chronos/src/modules/<feature>/schema.ts`; only the shared identity and RBAC tables stay in `apps/chronos/src/database/schema` (`authentication.ts`, `authorization.ts`, `api-keys.ts` — every other table has a foreign key to them). Never hand-edit generated SQL under `apps/chronos/src/database/migrations`.
- Reuse shared column helpers from `apps/chronos/src/database/helpers.ts` instead of re-declaring timestamp columns.
- Follow the table style in `apps/chronos/src/modules/doorlock/schema.ts`: explicit foreign keys, intentional `onDelete` behavior, and indexes or composite keys where the relationship needs them.
- A module's tables are exported as a schema map from its `schema.ts` and MUST be added to `moduleSchemas` in `apps/chronos/src/modules/schemas.ts` — that list is what Drizzle's runtime schema is built from (it stays separate from the module manifests so `database/index.ts` can import it without creating an import cycle).
- After intentional schema changes, generate the migration with the `db:*` scripts in `apps/chronos/package.json`.
- If backend route or frontend form code depends on a changed shape, update those callers in the same change rather than leaving a contract mismatch. Wire-facing response shapes live in `packages/api/src/domains` — update those contracts together with the tables.
