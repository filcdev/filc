# Preview databases

Each pull-request preview gets its own Postgres database, created automatically
on first boot.

## How it works

`apps/chronos/src/database/index.ts` reads `CHRONOS_DATABASE_NAME`. When set, on
startup Chronos:

1. sanitizes it into a safe identifier (`filc_<...>`, max 63 chars),
2. creates that database on the server in `CHRONOS_DATABASE_URL` if missing,
3. connects to it and runs migrations.

## Configuration (Preview Deployment env group)

    CHRONOS_DATABASE_URL=postgres://user:pass@<shared-pg>:5432/postgres
    CHRONOS_DATABASE_NAME=$COOLIFY_FQDN

Leave `CHRONOS_DATABASE_NAME` unset in production so the main deployment keeps
using the database in `CHRONOS_DATABASE_URL`.

## Cleanup

`bun run db:cleanup-previews` drops `filc_*` databases older than
`CHRONOS_PREVIEW_DATABASE_MAX_AGE_DAYS`. It requires
`CHRONOS_PREVIEW_DATABASE_URL` and never touches the databases in
`CHRONOS_DATABASE_URL` / `CHRONOS_PREVIEW_DATABASE_URL`.

## Required privileges

- The role in `CHRONOS_DATABASE_URL` needs `CREATEDB` (or superuser) when
  `CHRONOS_DATABASE_NAME` is set, so it can create the per-preview database.
- `CHRONOS_PREVIEW_DATABASE_URL` is a restricted cleanup-only connection. Its
  role needs:
  - `pg_read_server_files` (or superuser) for `pg_stat_file`;
  - ownership of each dropped database (or superuser);
  - ownership of the target sessions or `pg_signal_backend` to terminate them.
