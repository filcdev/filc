# filc

Filc monorepo is a collection of packages that are used to build the Filc application. It includes the following packages:

- [apps/](./apps): The main applications
  - [backend](./apps/backend): The backend server (Express)
  - [frontend](./apps/frontend): The web frontend (TanStack Router)
- [packages/](./packages): The shared packages
  - [api](./packages/api): The API (tRPC)
  - [auth](./packages/auth): Authentication (RYOA + JWT)
  - [config](./packages/config): Thin-wrapper and types around [filc.config.json](./filc.config.json)
  - [db](./packages/db): The database (Prisma + SQLite)
  - [rbac](./packages/rbac): Role-based access control (RBAC) system
- [tooling/](./tooling): The tooling packages
  - [eslint](./tooling/eslint): ESLint configuration
  - [prettier](./tooling/prettier): Prettier configuration
  - [typescript](./tooling/typescript): TypeScript configuration
  - [github](./tooling/github): GitHub Actions configuration

## Requirements

Refer to the [.nvmrc](/.nvmrc) and [package.json](./package.json) files.

## Prepare your environment

**BEFORE you do anything:**

```bash
cd packages/db
cp .env.example .env
```

Now, open up .env, and edit your DATABASE_URL to an ABSOLUTE PATH
For example:

```bash
# Linux
DATABASE_URL="file:///home/username/Documents/dev/filc/packages/db/dev.db"
# Windows
DATABASE_URL="file:C:/Users/username/Documents/dev/filc/packages/db/dev.db"
# Mac
DATABASE_URL="file:///Users/username/Documents/dev/filc/packages/db/dev.db"
```

After that, open ./filc.config.json and set `database.url` to the same value as you set in the .env file.

```json
{
  "database": {
    "url": "file:///home/username/Documents/dev/filc/packages/db/dev.db"
  }
}
```

## Starting the project

In the root directory, run:

```bash
pnpm install
pnpm db:push
pnpm dev
```

## Communication

Join the [Discord server](https://discord.gg/hpJqjxTJ2p) for discussion.
