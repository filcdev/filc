FROM oven/bun:1.3.9-alpine AS base
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS prepare
RUN bun add -g turbo@^2
COPY . .

RUN turbo prune @filcdev/chronos --docker

FROM base AS install
COPY --from=prepare /app/out/json/ .
RUN bun install --production

FROM base AS builder
COPY --from=prepare /app/out/json/ .
RUN bun install

COPY --from=prepare /app/out/full/ .

RUN bun run build --filter=@filcdev/chronos

FROM base AS release
COPY --from=builder /app/apps/chronos/src/database/migrations ./src/database/migrations
COPY --from=builder /app/apps/chronos/dist ./dist

# run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "--bun", "run", "dist/index.js" ]
