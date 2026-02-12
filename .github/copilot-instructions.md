# Filc Repository - Copilot Agent Instructions

## Repository Overview

**Filc** is a full-stack school management system consisting of two main applications in a Turborepo monorepo:
- **Chronos** (`apps/chronos/`): Backend API server built with Hono, providing REST endpoints for timetable management, doorlock access control, user management, and authentication
- **Iris** (`apps/iris/`): Frontend React application built with Vite, TanStack Router, and shadcn/ui components

**Repository Size**: ~150 source files | **Runtime**: Bun 1.3.9 | **Type**: TypeScript monorepo

## Technology Stack

### Backend (Chronos)
- **Runtime**: Bun 1.3.9
- **Framework**: Hono with OpenAPI support
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: better-auth with Microsoft Entra ID
- **Background Jobs**: cronbake for cron scheduling
- **Validation**: Zod schemas

### Frontend (Iris)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Routing**: TanStack Router (file-based)
- **UI Library**: shadcn/ui with Base UI components
- **Styling**: Tailwind CSS v4
- **State Management**: TanStack Query

### Shared Tools
- **Monorepo**: Turborepo 2.8.7
- **Package Manager**: Bun (NOT npm/yarn/pnpm)
- **Linter/Formatter**: Biome (replaces ESLint + Prettier)
- **Git Hooks**: Husky + lint-staged

## Build and Development Workflow

### Initial Setup (Dev Container)
The repository uses a dev container with Docker Compose (PostgreSQL + app container). When opening in VS Code, dependencies are automatically installed via `postCreateCommand: bun install`.

### Core Commands (VALIDATED)

**Always use `bun` instead of `npm` or `yarn`. All commands validated as working:**

```bash
# Install dependencies (run from root)
bun install                    # ~5-10s

# Linting (Biome checks + auto-fix)
bun lint                       # Or: bun biome check --write .
                               # ~300ms, checks 148 files

# Type checking (runs in both apps via Turbo)
bun typecheck                  # ~20s first run, uses Turbo cache

# Build (production builds both apps)
bun run build                  # ~11s (Chronos: Bun.build, Iris: Vite)

# Development mode
bun dev                        # Starts both apps concurrently
                               # Chronos: http://localhost:3001
                               # Iris: http://localhost:3000 (proxies /api to 3001)
```

### App-Specific Commands

```bash
# Chronos (backend) - run from apps/chronos/
bun dev                        # Hot-reload with --hot flag
bun build                      # Creates dist/index.js
bun typecheck                  # TypeScript validation
bun db:generate                # Generate Drizzle migrations
bun db:migrate                 # Apply migrations
bun db:studio                  # Opens Drizzle Studio
bun db:seed                    # Seed database with test data
bun db:reset                   # Reset and reseed database

# Iris (frontend) - run from apps/iris/
bun dev                        # Vite dev server on port 3000
bun build                      # Vite production build
bun typecheck                  # TypeScript validation
```

### Command Execution Order

**CRITICAL**: When making changes, always run commands in this order:
1. `bun install` (if dependencies changed)
2. `bun lint` (auto-fixes formatting issues)
3. `bun typecheck` (catches type errors)
4. `bun run build` (validates builds work)

**DO NOT** run `bun build` without `bun run` - it will fail with "Missing entrypoints" error. Always use `bun run build` from root.

## Project Structure

### Root Configuration Files
- `package.json` - Workspace config with Turbo scripts and catalog dependencies
- `turbo.json` - Turborepo pipeline configuration (build/typecheck/dev tasks)
- `biome.jsonc` - Comprehensive linting rules (514 lines, strict configuration)
- `bunfig.toml` - Bun runtime configuration
- `.husky/pre-commit` - Runs `bunx lint-staged` on staged files
- `.env` - Root environment (committed, only has DO_NOT_TRACK=1)

### Chronos Structure (`apps/chronos/`)
```
src/
├── index.ts              # Main entry point, Hono app setup
├── _types/               # TypeScript type definitions
├── database/
│   ├── schema/           # Drizzle schemas: authentication, authorization, doorlock, timetable
│   ├── migrations/       # Auto-generated SQL migrations
│   ├── scripts/          # seed.ts, reset.ts
│   └── index.ts          # Database connection setup
├── middleware/           # auth.ts, security.ts, timing.ts
├── routes/               # Feature-based routing
│   ├── cohort/           # Each has _factory.ts, _router.ts, index.ts pattern
│   ├── doorlock/         # Access control + WebSocket handler
│   ├── ping/             # Health checks
│   ├── timetable/        # Main business logic
│   └── users/
└── utils/                # Shared utilities (auth, authorization, logger, cron)
```

**Key Files**:
- `drizzle.config.ts` - Database connection config (reads from env.databaseUrl)
- `build.ts` - Custom Bun build script (creates dist/index.js)
- `.env.example` - Template with Azure Entra ID config requirements

### Iris Structure (`apps/iris/`)
```
src/
├── main.tsx              # Entry point, router + i18n setup
├── route-tree.gen.ts     # Auto-generated by TanStack Router (DO NOT EDIT)
├── global.css            # Tailwind base styles
├── components/
│   ├── ui/               # shadcn components
│   ├── admin/            # Admin panel components
│   ├── doorlock/         # Access control UI
│   ├── subs/             # Substitution views
│   └── timetable/        # Timetable visualization
├── routes/               # File-based routing
│   ├── __root.tsx        # Root layout
│   ├── _private/         # Protected routes
│   ├── _public/          # Public routes
│   ├── admin/            # Admin pages
│   └── auth/             # Login/auth pages
├── hooks/                # Custom React hooks
└── utils/                # Client utilities (hc.ts for API client, i18n.ts)
```

**Key Files**:
- `vite.config.ts` - Vite setup with TanStack Router plugin, Tailwind, proxy config
- `components.json` - shadcn configuration (base-maia style, zinc theme)
- `public/locales/` - i18n translations (en, hu)

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/check.yml`) runs on push to main and all PRs:

1. **Lint Job**: `bun install` → `bun biome check .` (fails on any lint errors)
2. **Typecheck Job**: `bun install` → `bun typecheck` (fails on type errors)

**Both jobs must pass** for PR approval. Jobs run independently in parallel.

**Caching**: Uses `~/.bun/install/cache` keyed by `bun.lockb` hash.

## Important Notes & Gotchas

### Biome Configuration
- **Auto-fixing**: `bun lint` auto-fixes most issues. Always run before committing.
- **Strict rules**: 514-line config with complexity limits, accessibility checks, CSS validation
- **Ignores**: Database migrations, generated route tree, bun.lock
- **Common violation**: `noExcessiveCognitiveComplexity` - some TODOs exist with biome-ignore comments

### Path Aliases
- **Chronos**: `#*` maps to `./src/*` (e.g., `import { db } from '#database'`)
- **Iris**: `@/*` maps to `./src/*` (e.g., `import { Button } from '@/components/ui/button'`)

### Environment Variables
- **Chronos requires**: `.env` file in `apps/chronos/` (copy from `.env.example`)
  - Database URL, Auth secret, Azure Entra ID credentials
  - Dev container provides PostgreSQL at `db:5432`
- **Iris**: No env file required for development (proxies to Chronos)

### Known Workarounds
- `apps/chronos/src/utils/authorization.ts:11` - CJS/ESM interop workaround for @rbac/rbac package
- TanStack Router generates `route-tree.gen.ts` automatically - never edit manually
- Drizzle migrations auto-generated - edit schema files, then run `bun db:generate`

### TypeScript Configuration
- Both apps use `@tsconfig/strictest` base config
- Chronos: `moduleResolution: bundler`, imports with `#` prefix work via paths
- Iris: `noEmit: true` (Vite handles compilation), `exactOptionalPropertyTypes: false` for shadcn

### Development Server Ports
- **Iris (Frontend)**: http://localhost:3000
- **Chronos (Backend)**: http://localhost:3001
- **API Proxy**: Iris proxies `/api/*` to Chronos automatically

## Validation Checklist

Before committing changes, ensure:
1. ✅ `bun install` completes without errors (if dependencies changed)
2. ✅ `bun lint` passes with no issues (use `--write` to auto-fix)
3. ✅ `bun typecheck` shows no type errors
4. ✅ `bun run build` succeeds for both apps
5. ✅ No changes to generated files (`route-tree.gen.ts`, migration SQL files)
6. ✅ Path aliases use correct prefix (`#` for Chronos, `@` for Iris)

## Trust These Instructions

These instructions were created through comprehensive exploration and validation of the codebase. All commands were tested and verified. Only search for additional information if:
- You need implementation details within specific source files
- You encounter an error not documented here
- You need to understand business logic in route handlers or components

For standard tasks (setup, build, lint, type checking), follow these instructions exactly as written.
