FROM oven/bun:1.4.2-alpine AS base
RUN apk update && apk add --no-cache libc6-compat && rm -rf /var/cache/apk/*
WORKDIR /app

FROM base AS prepare
RUN bun add -g turbo@^2
COPY . .

RUN turbo prune @filcdev/iris --docker

FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN bun install --frozen-lockfile

COPY --from=prepare /app/out/full/ .

RUN bun run build --filter=@filcdev/iris

FROM base AS release
ENV NODE_ENV=production
ENV PORT=3000
# The server bundle keeps `react`/`react-dom`/`@tanstack/*` external and
# resolves them by walking up from its own directory, so `dist` is placed under
# `apps/iris/` — next to the `node_modules` that holds them. Both levels are
# copied at their original relative path because `apps/iris/node_modules/*` are
# symlinks into the root `node_modules/.bun` store; flattening or merging the
# two levels breaks resolution. `bun x` is avoided: it would fetch srvx from the
# network at container start.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/iris/node_modules ./apps/iris/node_modules
COPY --from=builder /app/apps/iris/dist ./apps/iris/dist
WORKDIR /app/apps/iris
USER bun
EXPOSE 3000/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:${PORT}/healthz || exit 1
ENTRYPOINT ["bun", "/app/apps/iris/node_modules/srvx/bin/srvx.mjs", "serve", "--prod", "--port", "3000", "-s", "/app/apps/iris/dist/client", "/app/apps/iris/dist/server/server.js"]
