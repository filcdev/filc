# Contributing to Filc

This guide gets you from a fresh clone to a running dev environment, then covers the workflow we expect for contributions.

## Prerequisites

- **Bun 1.4.0+** — the exact version is pinned in [`mise.toml`](mise.toml); if you use [mise](https://mise.jdx.dev), it installs the right version automatically. Use `bun` only — no npm/pnpm/yarn.
- **PostgreSQL** — any local Postgres works. Two options:

  - **Disposable container (recommended)**: the [`pg-dispo`](https://gist.github.com/nemvince/89c8f12e8dd4f4eec8d31aa9a9018a73#file-pg-dispo) script — a single command that starts a Postgres 16+ container with defaults `postgresql://postgres:postgres@localhost:5432/postgres`.

  - **Compose stack**: `docker compose up -d` at the repo root runs Postgres 18 (Alpine) and [Mailpit](https://mailpit.axllent.org) (SMTP capture). Mailpit is already wired into [`apps/chronos/.env.example`](apps/chronos/.env.example); the web UI is at <http://localhost:8025>. Only use one Postgres source at a time — both bind host port 5432.

1. Clone and install:

   ```bash
   git clone https://github.com/filcdev/filc.git
   cd filc
   bun install
   ```

2. Start Postgres — either `pg-dispo start` or `docker compose up -d` (the latter also starts Mailpit for SMTP capture).

3. Configure environment files:

   ```bash
   cp apps/chronos/.env.example apps/chronos/.env
   cp apps/iris/.env.example apps/iris/.env # optional, sentry only
   ```

   The example files document every variable. Required before the app runs:

   - `CHRONOS_AUTH_SECRET` — generate with `openssl rand -base64 32`
   - `CHRONOS_ADMIN_EMAIL` — the admin bootstrap account
   - `CHRONOS_DATABASE_URL` — point it at your local Postgres
   - Entra (Microsoft) OAuth values — see [docs/entra-setup.md](docs/entra-setup.md)

4. **Optional** - Apply migrations:

    > [!tip]
    > Chronos applies migrations on startup, and seeding should not be necessary to log in.

   ```bash
   cd apps/chronos
   bun run db:migrate   # apply Drizzle migrations
   bun run db:seed      # optional: seed data
   cd ../..
   ```

5. Start the dev environment:

   ```bash
   bun dev
   ```

   Both apps start via Turborepo. Iris runs through Vite, which regenerates `apps/iris/src/route-tree.gen.ts` automatically — never edit that file by hand.

## Daily workflow

- Run everything from the repo root with `bun` only.
- Validation order before opening a PR:

  ```bash
  bun run lint       # biome check --write (auto-fixes)
  bun run typecheck  # tsc across all workspaces
  bun run build      # required if you touched bundler config, routers, or server entrypoints

  # Optional - Check CI passes with https://github.com/nektos/act
  ```

  CI runs the same checks (without auto-fix) on every push and PR.

- **Schema changes**: edit sources under `apps/chronos/src/database/schema`, then generate and commit the migration:

  ```bash
  cd apps/chronos
  bun run db:generate
  ```

  **NEVER** hand-edit generated files under `apps/chronos/src/database/migrations`.

- **User-facing text** must be added to both locale files: `apps/iris/public/locales/en/translation.json` and `apps/iris/public/locales/hu/translation.json`.
- Run `bun install` after pulling changes that touch dependencies.

## Conventions

[`AGENTS.md`](AGENTS.md) at the repo root is the authoritative source for code conventions: route layout, middleware, API contracts, hooks, forms, query keys. AI coding agents read it automatically; treat it as the reference too. When unsure where something should live, mirror the structure of an existing feature (doorlock, timetable, …) instead of inventing a parallel pattern.

## Pull requests

- Open PRs against `main`; keep commits focused per feature.
- Use the PR template — it doubles as the definition of done.
- CI must be green; if a check fails, fix it rather than suppressing it.

## Reporting issues

Use the issue templates for bug reports and feature requests. For security vulnerabilities, follow [SECURITY.md](SECURITY.md) — do not open a public issue.
