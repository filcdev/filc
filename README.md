![Repo Banner](./docs/assets/repo-banner.jpg)

---

<p align="center" style="padding-top: 10px">
  <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/filcdev/filc/check.yml?style=for-the-badge&label=CI&labelColor=09090b&color=15ba81&logo=githubactions&logoColor=white">
<img alt="API" src="https://img.shields.io/website?url=https%3A%2F%2Ffilc.hu%2Fapi%2Fping&style=for-the-badge&label=API&labelColor=09090b&logo=uptimekuma&logoColor=white">
<img alt="License" src="https://img.shields.io/badge/License-AGPL--3.0-009869?style=for-the-badge&labelColor=09090b&color=71717b&logo=opensourceinitiative&logoColor=white">
</p>

<p align="center">
  <img alt="Bun" src="https://img.shields.io/npm/v/bun?style=for-the-badge&label=Bun&labelColor=09090b&color=a51d61&logo=bun&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/npm/v/typescript?style=for-the-badge&label=TypeScript&labelColor=09090b&color=3178c6&logo=typescript&logoColor=white">
  <img alt="React" src="https://img.shields.io/npm/v/react?style=for-the-badge&label=React&labelColor=09090b&color=4496a9&logo=react&logoColor=white">
</p>

## Repository layout

| Path           | Description                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/chronos` | Hono + Drizzle backend: API, auth (better-auth), scheduled jobs                                         |
| `apps/iris`    | React 19 + Vite frontend: TanStack Router / Query / Form                                                |
| `packages/api` | Shared API contract (`@filcdev/api`): zod wire schemas, error types, permission constants, typed client |

## Quickstart

```bash
bun install   # Bun 1.4.0+, package.json -> packageManager
bun run dev   # starts chronos and iris via Turborepo
```

New here? Start with [CONTRIBUTING.md](CONTRIBUTING.md) - setup, environment configuration, and the contribution workflow. Architecture notes live in [docs/architecture.md](docs/architecture.md).
