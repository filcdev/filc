FROM oven/bun:1.2.13-alpine AS base

FROM base AS builder
ENV TURBO_TELEMETRY_DISABLED=1

WORKDIR /app
RUN bun add -g turbo
COPY . .
RUN turbo prune @filc/server --docker


FROM base AS installer
ENV TURBO_TELEMETRY_DISABLED=1

WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN bun install
COPY --from=builder /app/out/full/ .

RUN bun run build


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 filcserver
RUN adduser --system --uid 1001 filcserver
USER filcserver
COPY --from=installer /app/apps/server/dist .
# Also copy the drizzle migrations for runtime DB migration support
COPY --from=installer /app/packages/db/drizzle ./drizzle

CMD FILC_ENV=prod bun run index.js