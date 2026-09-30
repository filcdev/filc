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
COPY --from=builder /app/apps/iris/dist ./dist
COPY --from=builder /app/apps/iris/server.ts ./server.ts
USER bun
EXPOSE 3000/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:${PORT}/healthz || exit 1
ENTRYPOINT ["bun", "run", "server.ts"]
