#syntax=docker/dockerfile:1.4
ARG NODE_VERSION="23.10.0"
FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine as base
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /workspace
RUN corepack enable

FROM base as fetcher
COPY pnpm*.yaml ./
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm-store \
  pnpm fetch --ignore-scripts

FROM fetcher as builder
ARG APP_NAME="@filc/backend"
ENV APP_NAME=${APP_NAME}
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN --mount=type=cache,target=/workspace/node_modules/.cache \
  pnpm turbo run build --filter="${APP_NAME}"

FROM builder as deployer
WORKDIR /workspace/apps/backend
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
