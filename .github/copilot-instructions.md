# Filc Agent Guidance

Use this file for repo-wide rules only. Prefer the scoped instruction files for app-specific work:

- [Chronos backend instructions](instructions/chronos.instructions.md)
- [Iris frontend instructions](instructions/iris.instructions.md)

## Repo Shape

- This is a Bun + Turborepo monorepo. Shared scripts live in [package.json](../package.json), task wiring lives in [turbo.json](../turbo.json), and lint rules live in [biome.jsonc](../biome.jsonc).
- [apps/chronos](../apps/chronos) is the Hono + Drizzle backend.
- [apps/iris](../apps/iris) is the React + Vite frontend.

## Commands

- Use `bun` only. Do not switch to `npm`, `pnpm`, or `yarn`.
- Run validation from the repo root in this order: `bun install` when dependencies change, `bun lint`, `bun typecheck`, `bun run build`.
- Do not use bare `bun build` from the repo root; the root build command is `bun run build`.
- No reliable repo-wide test command is documented. Do not invent one unless the task is explicitly about adding tests.

## Conventions

- Use the correct path alias for the app you are editing: `#...` in Chronos and `@/...` in Iris.
- Do not hand-edit generated files such as [apps/iris/src/route-tree.gen.ts](../apps/iris/src/route-tree.gen.ts) or SQL files under [apps/chronos/src/database/migrations](../apps/chronos/src/database/migrations).
- Backend commands that need auth or database configuration rely on [apps/chronos/.env.example](../apps/chronos/.env.example).
- If a change crosses backend and frontend, keep the API contract and client usage aligned before finishing.

## References

- Chronos scripts and package metadata: [apps/chronos/package.json](../apps/chronos/package.json)
- Iris scripts and package metadata: [apps/iris/package.json](../apps/iris/package.json)
