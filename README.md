TODO: banner image

The core of the Filc application stack: **chronos**, the Hono + Drizzle API, and **iris**, the React frontend - built to simplify time management and scheduling for schools.

[![CI](https://github.com/filcdev/filc/actions/workflows/check.yml/badge.svg)](https://github.com/filcdev/filc/actions/workflows/check.yml)

## Repository layout

| Path | Description |
| --- | --- |
| `apps/chronos` | Hono + Drizzle backend: API, auth (better-auth), scheduled jobs |
| `apps/iris` | React 19 + Vite frontend: TanStack Router / Query / Form |
| `packages/api` | Shared API contract (`@filcdev/api`): zod wire schemas, error types, permission constants, typed client |

## Quickstart

```bash
bun install   # Bun 1.4.0+, package.json -> packageManager
bun run dev   # starts chronos and iris via Turborepo
```

New here? Start with [CONTRIBUTING.md](CONTRIBUTING.md) — setup, environment configuration, and the contribution workflow. Architecture notes live in [docs/architecture.md](docs/architecture.md).

## License

[AGPL-3.0](LICENSE)
