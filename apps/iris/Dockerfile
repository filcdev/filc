FROM oven/bun:1.3.4-alpine AS base
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS prepare
RUN bun add -g turbo@^2
COPY . .

RUN turbo prune @filcdev/iris --docker

FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN bun install

COPY --from=prepare /app/out/full/ .

RUN bun run build --filter=@filcdev/iris

FROM nginx:alpine AS release
COPY --from=builder /app/apps/iris/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/apps/iris/dist /usr/share/nginx/html
EXPOSE 80/tcp
ENTRYPOINT ["nginx", "-g", "daemon off;"]