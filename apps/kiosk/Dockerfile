FROM oven/bun:1.4.0-alpine AS base
RUN apk update && apk add --no-cache libc6-compat && rm -rf /var/cache/apk/*
WORKDIR /app

FROM base AS prepare
RUN bun add -g turbo@^2
COPY . .

RUN turbo prune @filcdev/kiosk --docker

FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN bun install --frozen-lockfile

COPY --from=prepare /app/out/full/ .

RUN bun run build --filter=@filcdev/kiosk

FROM nginx:1.29-alpine AS release
COPY --from=builder /app/apps/kiosk/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/apps/kiosk/dist /usr/share/nginx/html
EXPOSE 80/tcp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
ENTRYPOINT ["nginx", "-g", "daemon off;"]
