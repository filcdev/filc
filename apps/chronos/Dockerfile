FROM oven/bun:1.4.3-alpine AS base
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
ENV CHRONOS_MODE=production
ENV CHRONOS_PORT=3001
COPY --from=builder /app/apps/chronos/src/database/migrations ./src/database/migrations
COPY --from=builder /app/apps/chronos/dist ./dist

# run the app
USER bun
EXPOSE 3001/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${CHRONOS_PORT}/api/health" || exit 1
# The OAuth proxy hands the whole encrypted login payload (claims, tokens,
# state) to a preview in a query string, which real Entra logins push past Bun's
# 16 KiB request-head default — the preview then answers 431 before any route
# runs. The API sets the same cap from CHRONOS_MAX_HTTP_HEADER_SIZE at startup;
# this flag stays as a launch-level default (the in-code value wins), and the
# shell form is what lets the variable reach it. See docs/entra-setup.md §6.
ENTRYPOINT [ "sh", "-c", "exec bun --max-http-header-size=\"${CHRONOS_MAX_HTTP_HEADER_SIZE:-65536}\" --bun run dist/index.js" ]
