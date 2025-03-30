ARG NODE_VERSION="23.10.0"
ARG BACKEND_PROJECT="@filc/backend"
ARG BACKEND_DIRECTORY="apps/backend"
ARG FRONTEND_PROJECT="@filc/frontend"
ARG FRONTEND_DIRECTORY="apps/frontend"

FROM --platform=linux/amd64 node:${NODE_VERSION}-alpine AS alpine
RUN apk update
RUN apk add --no-cache libc6-compat

FROM alpine AS base
RUN corepack enable
RUN pnpm install turbo
RUN pnpm config set store-dir ~/.pnpm-store

# Prune backend
FROM base AS backend-pruner
ARG BACKEND_PROJECT
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune --scope=${BACKEND_PROJECT} --docker

# Prune frontend
FROM base AS frontend-pruner
ARG FRONTEND_PROJECT
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune --scope=${FRONTEND_PROJECT} --docker

# Combine and build both projects
FROM base AS builder
WORKDIR /app
# Copy package.json files from both pruners
COPY --from=backend-pruner /app/out/json/ .
COPY --from=frontend-pruner /app/out/json/ .
# Use one of the workspace files (they should be identical)
COPY --from=backend-pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=backend-pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
# Install dependencies
RUN --mount=type=cache,id=pnpm,target=~/.pnpm-store pnpm install
# Copy source code from both pruners
COPY --from=backend-pruner /app/out/full .
COPY --from=frontend-pruner /app/out/full .
# Build both projects
ARG BACKEND_PROJECT
ARG FRONTEND_PROJECT
RUN pnpm build

# Backend runner
FROM base AS backend-runner
ARG BACKEND_DIRECTORY
RUN addgroup -g 1001 -S filc
RUN adduser -u 1001 -S filc -G filc
USER filc
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=filc:filc /app .
WORKDIR /app/${BACKEND_DIRECTORY}
RUN corepack install
EXPOSE 4000
CMD ["node", "dist/index.js"]

# Frontend with Nginx
FROM nginx:alpine AS frontend
ARG FRONTEND_DIRECTORY
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
# Copy static assets from builder stage
COPY --from=builder /app/${FRONTEND_DIRECTORY}/dist .
# Copy custom nginx conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
