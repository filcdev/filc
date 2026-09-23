FROM oven/bun:1.4.2-alpine AS base
RUN apk update && apk add --no-cache libc6-compat && rm -rf /var/cache/apk/*
WORKDIR /app

FROM base AS prepare
RUN bun add -g turbo@^2
COPY . .

RUN turbo prune @filcdev/chronos --docker

FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN bun install --frozen-lockfile

COPY --from=prepare /app/out/full/ .

RUN bun run build --filter=@filcdev/chronos

FROM base AS release
ENV NODE_ENV=production
ENV CHRONOS_PORT=3001
COPY --from=builder /app/apps/chronos/src/database/migrations ./src/database/migrations
COPY --from=builder /app/apps/chronos/dist ./dist

# run the app
USER bun
EXPOSE 3001/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${CHRONOS_PORT}/api/health" || exit 1
ENTRYPOINT [ "bun", "--bun", "run", "dist/index.js" ]
