FROM oven/bun:1.2.13-alpine AS base

FROM base AS builder
ENV TURBO_TELEMETRY_DISABLED=1

WORKDIR /app
RUN bun add -g turbo
COPY . .
RUN turbo prune @filc/web --docker


FROM base AS installer
ENV TURBO_TELEMETRY_DISABLED=1

WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN bun install
COPY --from=builder /app/out/full/ .

RUN bun run build


FROM rtsp/lighttpd AS runner
COPY --from=installer /app/apps/web/dist /var/www/html