FROM oven/bun:1.4.0-alpine AS base
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS prepare
RUN bun add -g turbo@^2
COPY . .

RUN turbo prune @filcdev/kiosk --docker

FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN bun install

COPY --from=prepare /app/out/full/ .

RUN bun run build --filter=@filcdev/kiosk

FROM nginx:alpine AS release
COPY --from=builder /app/apps/kiosk/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/apps/kiosk/dist /usr/share/nginx/html
EXPOSE 80/tcp
ENTRYPOINT ["nginx", "-g", "daemon off;"]
